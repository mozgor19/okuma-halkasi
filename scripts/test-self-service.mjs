import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import { readDevelopmentMail } from "./development-mail.mjs";
import { readGroupsDevelopmentSettings } from "./groups-development.mjs";
import { groupsConfigPath, groupsStatePath, testOrigin, testOutputPath, testRunId } from "./test-environment.mjs";

if (!testRunId) throw new Error("Run this suite only in a fresh isolated self-service environment.");
const origin = testOrigin;
const output = testOutputPath("self-service");
mkdirSync(output, { recursive: true });
const config = await (await fetch(origin + "/api/onboarding/config")).json();
assert.equal(config.enabled, true); assert.equal(config.local, true); assert.equal(config.ready, true);
const suffix = Date.now().toString(36);
const password = "Isolated-Books-7429!";
const results = [];
async function check(name, fn) { await fn(); results.push({ name, status: "passed" }); console.log(`ok ${results.length} - ${name}`); }
function sql(command) {
  const result = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local", "--config", groupsConfigPath, "--persist-to", groupsStatePath, "--json", "--command", command], { encoding: "utf8", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
  assert.equal(result.status, 0, "Local test SQL failed"); return JSON.parse(result.stdout).flatMap((item) => item.results || []);
}
class Client {
  cookies = new Map(); group = null;
  async request(path, { expected = 200, json, headers = {}, method = "GET" } = {}) {
    const response = await fetch(origin + path, { method, redirect: "manual", headers: { Origin: origin, Cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "), ...(this.group ? { "X-Reading-Group": this.group } : {}), ...(json === undefined ? {} : { "Content-Type": "application/json" }), ...headers }, body: json === undefined ? undefined : JSON.stringify(json) });
    for (const line of response.headers.getSetCookie()) { const pair = line.split(";")[0]; const split = pair.indexOf("="); this.cookies.set(pair.slice(0, split), pair.slice(split + 1)); }
    assert.equal(response.status, expected, `${method} ${path}: ${response.status !== expected ? await response.text() : ""}`);
    return response;
  }
  async post(action, json, expected = 200, headers) {
    const response = await this.request(`/api/onboarding/${action}`, { method: "POST", json, expected, headers });
    return response.headers.get("content-type")?.includes("application/json") ? response.json() : { rejected: true };
  }
  async login(username, candidate = password, expected = 200) { return (await this.request("/api/auth/login", { method: "POST", json: { username, password: candidate }, expected })).json(); }
  async select(id) { await this.request("/api/groups", { method: "POST", json: { groupId: id }, headers: { "X-Reading-Group": id } }); this.group = id; }
}
function tokenFor(email, flow) {
  const mail = readDevelopmentMail(email).find((item) => item.body.includes(`/${flow}#token=`));
  assert.ok(mail, "Expected local test email");
  return /#token=([a-f0-9]{64})/.exec(mail.body)[1];
}
const alice = new Client(), bob = new Client(), charlie = new Client(), anonymous = new Client();
const users = ["alice", "bob", "charlie"].map((name) => ({ name: `Test ${name}`, username: `${name}.${suffix}`, email: `${name}.${suffix}@example.test`, password, acceptedPolicy: true }));
let group, invite, winner, loser;

await check("Public registration is same-origin, bounded and does not accept weak passwords", async () => {
  await anonymous.post("register", users[0], 403, { Origin: "https://evil.example" });
  await anonymous.post("register", { ...users[0], password: "short" }, 400);
  await anonymous.post("register", { ...users[0], acceptedPolicy: false }, 400);
  await anonymous.post("register", { ...users[0], name: "<script>" }, 400);
  await anonymous.post("register", { padding: "x".repeat(9000) }, 413);
  await anonymous.request("/@fs/" + groupsConfigPath, { expected: 403 });
});
await check("Registration waits for mailbox proof; tokens are hashed, one-use and expiring", async () => {
  for (const user of users) await anonymous.post("register", user);
  await alice.login(users[0].username, password, 401);
  const token = tokenFor(users[0].email, "verify-email");
  assert.equal(sql(`SELECT count(*) AS count FROM pending_registrations WHERE token_hash = '${token}'`)[0].count, 0);
  await anonymous.post("verify-email", { token });
  await anonymous.post("verify-email", { token }, 400);
  for (const user of users.slice(1)) await anonymous.post("verify-email", { token: tokenFor(user.email, "verify-email") });
  await anonymous.post("verify-email", { token: "0".repeat(64) }, 400);
});
await check("An account with no memberships can sign in but cannot read default-group data", async () => {
  const login = await alice.login(users[0].username);
  assert.equal(login.next, "/groups"); assert.equal(login.selfService, true);
  await bob.login(users[1].username); await charlie.login(users[2].username);
  assert.deepEqual((await (await alice.request("/api/groups")).json()).groups, []);
  await alice.request("/api/state", { expected: 403 });
});
await check("Group creation is idempotent under concurrent retries and grants local ownership only", async () => {
  const requestKey = randomUUID();
  const [first, second] = await Promise.all([alice.post("create-group", { name: "Yeni Kitap Dostları", requestKey }), alice.post("create-group", { name: "Yeni Kitap Dostları", requestKey })]);
  assert.equal(first.group.id, second.group.id); group = first.group;
  assert.equal(group.role, "super_admin");
  await alice.select(group.id);
  const state = await (await alice.request("/api/state")).json();
  assert.equal(state.books.length, 0); assert.equal(state.members.length, 1); assert.equal(state.members[0].role, "super_admin");
  assert.equal(sql(`SELECT count(*) AS count FROM reading_group_memberships WHERE group_id = '${group.id}'`)[0].count, 1);
});
await check("Invite redemption is atomic at its last slot and never grants administrator role", async () => {
  invite = await alice.post("invitations", { maxUses: 1, days: 1 });
  assert.match(invite.token, /^[a-f0-9]{64}$/);
  assert.equal(sql(`SELECT count(*) AS count FROM group_invitations WHERE token_hash = '${invite.token}'`)[0].count, 0);
  const attempts = await Promise.all([bob, charlie].map(async (client) => {
    const response = await fetch(origin + "/api/onboarding/join-group", { method: "POST", headers: { Origin: origin, Cookie: [...client.cookies].map(([k, v]) => `${k}=${v}`).join("; "), "Content-Type": "application/json" }, body: JSON.stringify({ token: invite.token, role: "super_admin" }) });
    return { client, status: response.status, body: await response.json() };
  }));
  assert.deepEqual(attempts.map((item) => item.status).sort(), [200, 400]);
  const success = attempts.find((item) => item.status === 200); winner = success.client; loser = attempts.find((item) => item.status === 400).client;
  assert.equal(success.body.group.role, "member");
  await winner.select(group.id);
  await winner.request("/api/onboarding/invitations", { expected: 403 });
  await winner.post("invitations", { maxUses: 10 }, 403);
});
await check("Revoked, expired and fabricated invites do not expose or join a group", async () => {
  const revoked = await alice.post("invitations", { maxUses: 2 });
  await alice.post("revoke-invitation", { id: revoked.id });
  await loser.post("join-group", { token: revoked.token }, 400);
  await loser.post("join-group", { token: "0".repeat(64) }, 400);
  const expired = await alice.post("invitations", { maxUses: 2 });
  sql(`UPDATE group_invitations SET expires_at = 1 WHERE id = '${expired.id}'`);
  await loser.post("join-group", { token: expired.token }, 400);
});
await check("Idempotent joins do not duplicate the member or consume another invitation slot", async () => {
  await winner.post("join-group", { token: invite.token });
  assert.equal(sql(`SELECT count(*) AS count FROM group_invitation_redemptions WHERE invitation_id = '${invite.id}'`)[0].count, 1);
  assert.equal((await (await alice.request("/api/state")).json()).members.length, 2);
});
await check("The same account creates another group, keeps independent appearance and switches safely", async () => {
  const other = await alice.post("create-group", { name: "İkinci Yeni Grup", requestKey: randomUUID() });
  const previous = group.id; await alice.select(other.group.id);
  await alice.request("/api/groups/appearance", { method: "PATCH", json: { scheme: "minimal", mode: "dark" } });
  await alice.request("/api/action", { method: "POST", json: { action: "createPlan" }, headers: { "X-Reading-Group": previous }, expected: 409 });
  await alice.select(previous);
  assert.equal((await (await alice.request("/api/state")).json()).readingGroup.scheme, "notebook");
  await alice.select(other.group.id);
  assert.equal((await (await alice.request("/api/state")).json()).readingGroup.scheme, "minimal");
  await alice.select(group.id);
});
await check("Password recovery is generic, one-use, and invalidates every old session", async () => {
  const known = await anonymous.post("forgot-password", { email: users[2].email });
  const unknown = await anonymous.post("forgot-password", { email: `unknown.${suffix}@example.test` });
  assert.deepEqual(known, unknown);
  const token = tokenFor(users[2].email, "reset-password");
  await anonymous.post("reset-password", { token, password: "short" }, 400);
  await anonymous.post("reset-password", { token, password: "Changed-Books-8429!" });
  await charlie.request("/api/groups", { expected: 401 });
  await anonymous.post("reset-password", { token, password }, 400);
  await charlie.login(users[2].username, "Changed-Books-8429!");
});
await check("Expired email proof cannot create an account; duplicate registration stays generic", async () => {
  const candidate = { ...users[0], username: `expired.${suffix}`, email: `expired.${suffix}@example.test` };
  await anonymous.post("register", candidate);
  const token = tokenFor(candidate.email, "verify-email");
  sql(`UPDATE pending_registrations SET expires_at = 1 WHERE username = '${candidate.username}'`);
  await anonymous.post("verify-email", { token }, 400);
  await anonymous.login(candidate.username, password, 401);
  const duplicate = await anonymous.post("register", users[1]);
  assert.equal(duplicate.ok, true);
});
await check("Existing users verify email without migrating their account or changing old permissions", async () => {
  const legacy = new Client();
  await legacy.login("demo.multi", readGroupsDevelopmentSettings().password);
  await legacy.post("link-email", { email: `legacy.${suffix}@example.test`, password: "incorrect" }, 400);
  await legacy.post("link-email", { email: `legacy.${suffix}@example.test`, password: readGroupsDevelopmentSettings().password });
  await anonymous.post("verify-email", { token: tokenFor(`legacy.${suffix}@example.test`, "verify-email") });
  await legacy.select("default");
  const defaultInvite = await legacy.post("invitations", { maxUses: 1 });
  const joined = await loser.post("join-group", { token: defaultInvite.token });
  assert.equal(joined.group.role, "member");
  await loser.select("default");
  const state = await (await loser.request("/api/state")).json();
  assert.equal(state.books[0].title, "Birinci Grup Kitabı");
  assert.equal(state.members.find((item) => item.id === state.currentMemberId).role, "member");
});
await check("An invitation cannot revive a disabled membership", async () => {
  const accountId = sql(`SELECT member_id FROM member_accounts WHERE username = '${winner === bob ? users[1].username : users[2].username}'`)[0].member_id;
  sql(`UPDATE reading_group_memberships SET is_active = 0 WHERE account_member_id = ${accountId} AND group_id = '${group.id}'`);
  try {
    const fresh = await alice.post("invitations", { maxUses: 2 });
    await winner.post("join-group", { token: fresh.token }, 403);
    await winner.request("/api/state", { expected: 403 });
  } finally { sql(`UPDATE reading_group_memberships SET is_active = 1 WHERE account_member_id = ${accountId} AND group_id = '${group.id}'`); }
});

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  await check("Web registration, verification and empty-account onboarding work through real forms", async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = []; page.on("pageerror", (error) => errors.push(error.message));
    page.setDefaultTimeout(30_000);
    await page.goto(origin + "/register");
    await page.getByLabel("Ad soyad").fill("Web Test Okuru");
    await page.getByLabel("Kullanıcı adı", { exact: true }).fill(`web.${suffix}`);
    await page.getByLabel("E-posta", { exact: true }).fill(`web.${suffix}@example.test`);
    await page.getByLabel("Yeni şifre", { exact: true }).fill(password);
    await page.getByLabel("Şifre tekrarı").fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Bilgiler uygunsa" }).waitFor();
    const token = tokenFor(`web.${suffix}@example.test`, "verify-email");
    await page.goto(origin + "/verify-email#token=" + token);
    await page.getByRole("button", { name: "E-postamı doğrula" }).click();
    await page.getByRole("status").filter({ hasText: "doğrulandı" }).waitFor();
    assert.equal(new URL(page.url()).hash, "");
    await page.goto(origin + "/login");
    await page.waitForFunction(() => { const input = document.getElementById("username"); return input && Object.keys(input).some((key) => key.startsWith("__reactProps")); });
    await page.getByLabel("Kullanıcı adı", { exact: true }).fill(`web.${suffix}`);
    await page.getByLabel("Şifre", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/groups");
    await page.getByRole("link", { name: "Grup kur veya katıl", exact: true }).click();
    await page.getByRole("tab", { name: "Grup kur", exact: true }).click();
    await page.getByLabel("Okuma grubu adı").fill("Webden Kurulan Okuma Grubu");
    await page.getByRole("button", { name: "Okuma grubu oluştur" }).click();
    await page.waitForURL((url) => url.pathname === "/" && url.searchParams.has("group"));
    await page.locator(".person-picker").filter({ hasText: "Web Test Okuru" }).waitFor();
    await page.getByRole("button", { name: "İlk buluşmayı oluştur", exact: true }).waitFor();
    await page.locator(".mobile-nav").getByRole("button", { name: "Profil", exact: true }).click();
    await page.getByText("Davetleri yönet", { exact: true }).click();
    await page.getByRole("button", { name: "Davet oluştur", exact: true }).click();
    await page.getByLabel("Davet bağlantısı", { exact: true }).waitFor();
    const url = await page.getByLabel("Davet bağlantısı", { exact: true }).inputValue();
    assert.match(url, /\/join#invite=[a-f0-9]{64}$/);
    const guest = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const join = await guest.newPage();
    join.setDefaultTimeout(30_000);
    await join.goto(url);
    await join.getByRole("link", { name: "Giriş yap", exact: true }).click();
    await join.waitForFunction(() => { const input = document.getElementById("username"); return input && Object.keys(input).some((key) => key.startsWith("__reactProps")); });
    await join.getByLabel("Kullanıcı adı", { exact: true }).fill(users[1].username);
    await join.getByLabel("Şifre", { exact: true }).fill(password);
    await join.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await join.waitForURL("**/join");
    await join.getByRole("button", { name: "Gruba katıl", exact: true }).click();
    await join.waitForURL((url) => url.pathname === "/" && url.searchParams.has("group"));
    await join.locator(".person-picker").filter({ hasText: users[1].name }).waitFor();
    assert.equal(await join.getByRole("heading", { name: "Son buluşma", exact: true }).count(), 0);
    assert.equal(await join.getByRole("button", { name: "İlk buluşmayı oluştur", exact: true }).count(), 0);
    await join.getByText("İlk buluşma henüz planlanmadı.", { exact: true }).waitFor();
    await join.screenshot({ path: `${output}/web-invited-member.png`, animations: "disabled" });
    await guest.close();
    // Do not screenshot a live invitation secret.
    await page.getByText("Davetleri yönet", { exact: true }).click();
    await page.screenshot({ path: `${output}/web-created-group-profile.png`, animations: "disabled" });
    assert.deepEqual(errors, []);
    await context.close();
  });
  await check("Account screens preserve every scheme and mode at mobile and desktop widths", async () => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) for (const mode of ["light", "dark"]) {
        await page.goto(origin + "/register");
        await page.waitForFunction(() => document.querySelector('.onboarding-form button[type="submit"]')?.disabled === false);
        await page.evaluate(({ scheme, mode }) => {
          localStorage.setItem("kitapTahlilScheme", scheme); localStorage.setItem("kitapTahlilColorMode", mode);
          document.documentElement.dataset.scheme = scheme; document.documentElement.dataset.mode = mode;
          document.documentElement.classList.toggle("dark", mode === "dark"); document.documentElement.style.colorScheme = mode;
        }, { scheme, mode });
        assert.deepEqual(await page.evaluate(() => ({ scheme: document.documentElement.dataset.scheme, dark: document.documentElement.classList.contains("dark") })), { scheme, dark: mode === "dark" });
        const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(geometry.scroll <= geometry.width + 1);
        await page.screenshot({ path: `${output}/register-${width}-${scheme}-${mode}.png`, fullPage: true, animations: "disabled" });
      }
    }
    await context.close();
  });
} finally { await browser.close(); }

await check("Capacity exhaustion does not reuse an existing group's data", async () => {
  await alice.post("create-group", { name: "Kapasite Test Grubu", requestKey: randomUUID() }, 503);
  assert.equal((await (await alice.request("/api/state")).json()).readingGroup.id, group.id);
});
await check("Concurrent recovery and password change cannot reuse or roll back a session version", async () => {
  await anonymous.post("forgot-password", { email: users[0].email });
  const token = tokenFor(users[0].email, "reset-password");
  const cookies = [...alice.cookies].map(([key, value]) => `${key}=${value}`).join("; ");
  const [changed, recovered] = await Promise.all([
    fetch(origin + "/api/auth/change-password", { method: "POST", headers: { Origin: origin, Cookie: cookies, "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: password, newPassword: "Concurrent-Change-8342!", confirmPassword: "Concurrent-Change-8342!" }) }),
    fetch(origin + "/api/onboarding/reset-password", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ token, password: "Concurrent-Recovery-9652!" }) }),
  ]);
  assert.equal(Number(changed.status === 200) + Number(recovered.status === 200), 1);
  assert.ok([200, 400, 401].includes(changed.status)); assert.ok([200, 400].includes(recovered.status));
  const version = sql(`SELECT session_version AS version FROM member_accounts WHERE username = '${users[0].username}'`)[0].version;
  assert.equal(version, 2);
  await alice.request("/api/groups", { expected: 401 });
});
await check("Sign-out rejects cross-origin requests and clears the authenticated session", async () => {
  await bob.request("/api/auth/logout", { method: "POST", headers: { Origin: "https://evil.example" }, expected: 403 });
  await bob.request("/api/groups");
  await bob.request("/api/auth/logout", { method: "POST" });
  await bob.request("/api/groups", { expected: 401 });
});
writeFileSync(`${output}/report.json`, JSON.stringify({ status: "passed", checks: results, noProductionWrites: true }, null, 2));
console.log(`Self-service passed: ${results.length} flows; 16 scheme/viewport screenshots. No live mail or production data used.`);
