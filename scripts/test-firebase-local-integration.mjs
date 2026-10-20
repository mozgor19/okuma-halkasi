import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { readDevelopmentMail } from "./development-mail.mjs";
import { groupsConfigPath, groupsStatePath, testOrigin, testOutputPath, testRunId } from "./test-environment.mjs";
import { localTestSql } from "./local-d1-test.mjs";

if (!testRunId.startsWith("firebase-local-") || process.env.OKUMA_FIREBASE_LOCAL !== "1") throw Error("LOCAL_FIREBASE_FIXTURE_REQUIRED");
const emulatorOrigin = new URL(process.env.OKUMA_FIREBASE_EMULATOR_ORIGIN);
if (emulatorOrigin.protocol !== "http:" || emulatorOrigin.hostname !== "127.0.0.1" || !emulatorOrigin.port || emulatorOrigin.pathname !== "/"
  || emulatorOrigin.username || emulatorOrigin.password || emulatorOrigin.search || emulatorOrigin.hash || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_TOKEN) throw Error("LOCAL_EMULATOR_REQUIRED");
process.env.FIREBASE_AUTH_EMULATOR_HOST = emulatorOrigin.host;
const prototypeRequire = createRequire(new URL("../prototypes/firebase-auth/package.json", import.meta.url));
const { initializeApp, deleteApp } = prototypeRequire("firebase-admin/app"), { getAuth } = prototypeRequire("firebase-admin/auth");
const adminApp = initializeApp({ projectId: "demo-koru-auth-local" }, "local-koru-integration"), admin = getAuth(adminApp);
const origin = testOrigin, output = testOutputPath("firebase-local"), checks = [];
mkdirSync(output, { recursive: true });
const sql = (command) => localTestSql({ config: groupsConfigPath, persistTo: groupsStatePath, command });
const password = "Synthetic-Only-Password-8296!", nextPassword = "Synthetic-Changed-Password-9458!";
const aliceData = { name: "Synthetic Local Alice", username: "firebase.alice", email: "alice@example.test", password, acceptedPolicy: true };
const bobData = { name: "Synthetic Local Bob", username: "firebase.bob", email: "bob@example.test", password, acceptedPolicy: true };
let operation;
class Client {
  cookies = new Map(); group = null; lastSetCookies = [];
  async request(path, { method = "GET", json, expected = 200, headers = {} } = {}) {
    operation = { path, method, expected };
    const response = await fetch(origin + path, { method, redirect: "manual", headers: { Origin: origin,
      Cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "), ...(this.group ? { "X-Reading-Group": this.group } : {}),
      ...(json === undefined ? {} : { "Content-Type": "application/json" }), ...headers }, body: json === undefined ? undefined : JSON.stringify(json) });
    if (response.status !== expected) {
      const value = await response.clone().json().catch(() => ({}));
      const code = /^[A-Z_]+$/.test(value.code) ? value.code : "RESPONSE";
      throw Error(`LOCAL_HTTP_${response.status}_EXPECTED_${expected}_${code}`);
    }
    this.lastSetCookies = response.headers.getSetCookie();
    for (const line of this.lastSetCookies) {
      const pair = line.split(";", 1)[0], split = pair.indexOf("=");
      this.cookies.set(pair.slice(0, split), pair.slice(split + 1));
    }
    return response;
  }
  async post(action, json, expected = 200, headers) {
    const response = await this.request("/api/onboarding/" + action, { method: "POST", json, expected, headers });
    if (expected >= 400 && !response.headers.get("content-type")?.includes("application/json")) return {};
    return response.json();
  }
  async login(username, candidate = password, expected = 200) { return (await this.request("/api/auth/login", { method: "POST", json: { username, password: candidate }, expected })).json(); }
  async select(id) { await this.request("/api/groups", { method: "POST", json: { groupId: id }, headers: { "X-Reading-Group": id } }); this.group = id; }
  clone() { const copy = new Client(); copy.cookies = new Map(this.cookies); copy.group = this.group; return copy; }
}
function mailToken(email, purpose) {
  const mail = readDevelopmentMail(email).find((item) => item.body.includes(`/${purpose}#token=`));
  const token = mail && /#token=([a-f0-9]{64})/.exec(mail.body)?.[1];
  if (!token) throw Error("LOCAL_MAIL_MISSING");
  return token;
}
let current = "preflight", browser, activePage, passed = false, failure;
const browserErrors = [];
async function hydrated(page, id) {
  await page.waitForFunction((id) => Object.keys(document.getElementById(id) || {}).some((key) => key.startsWith("__reactProps")), id);
}
async function check(name, action) { current = name; await action(); checks.push({ name, status: "passed" }); console.log(`ok ${checks.length} - ${name}`); }
const alice = new Client(), bob = new Client(), anonymous = new Client();
let first, second, resetToken, alicePassword = nextPassword;
try {
  await check("Local provider configuration is enabled only in the isolated fixture", async () => {
    const config = await (await anonymous.request("/api/onboarding/config")).json();
    assert.equal(config.enabled, true); assert.equal(config.ready, true); assert.equal(config.local, true);
    assert.equal(sql("SELECT project_id FROM firebase_local_environment")[0].project_id, "demo-koru-auth-local");
  });
  const legacyBefore = createHash("sha256").update(JSON.stringify(sql("SELECT * FROM members WHERE id<=3 ORDER BY id"))).digest("hex");
  await check("Actual registration route enforces same-origin, policy, password and synthetic-email boundaries", async () => {
    await anonymous.post("register", aliceData, 403, { Origin: "https://birkoru.com" });
    await anonymous.post("register", { ...aliceData, password: "short" }, 400);
    await anonymous.post("register", { ...aliceData, email: "koru.destek@gmail.com" }, 400);
    await anonymous.post("register", { ...aliceData, acceptedPolicy: false }, 400);
    await anonymous.post("register", { ...aliceData, name: "<script>" }, 400);
  });
  await check("Provider registration stores no password/hash and cannot login or allocate memberships before verification", async () => {
    await anonymous.post("register", aliceData); await anonymous.post("register", bobData);
    await alice.login(aliceData.username, password, 401);
    assert.equal(sql("SELECT count(*) AS n FROM firebase_local_links")[0].n, 0);
    assert.equal(sql("SELECT count(*) AS n FROM member_accounts")[0].n, 0);
    const registration = sql("PRAGMA table_info(firebase_local_registrations)");
    assert.equal(registration.some((item) => /password|salt|hash/.test(item.name)), false);
  });
  await check("Existing verification screen uses hashed one-use bridge tokens and provider confirmation", async () => {
    const token = mailToken(aliceData.email, "verify-email");
    assert.equal(sql(`SELECT count(*) AS n FROM firebase_local_actions WHERE token_hash='${token}'`)[0].n, 0);
    await anonymous.request("/verify-email");
    await anonymous.post("verify-email", { token }); await anonymous.post("verify-email", { token }, 400);
    await anonymous.post("verify-email", { token: mailToken(bobData.email, "verify-email") });
    assert.equal(sql("SELECT count(*) AS n FROM firebase_local_links")[0].n, 2);
    assert.equal(sql("SELECT count(*) AS n FROM reading_group_memberships WHERE account_member_id>3")[0].n, 0);
  });
  await check("Expired pending signup resumes only with its checkpointed UID/password and invalidates older mail", async () => {
    const pending = { ...aliceData, username: "firebase.pending", email: "pending@example.test" };
    await anonymous.post("register", pending);
    const oldToken = mailToken(pending.email, "verify-email");
    sql("UPDATE firebase_local_registrations SET expires_at=1 WHERE username='firebase.pending'");
    const before = sql("SELECT count(*) AS n FROM firebase_local_actions")[0].n;
    await anonymous.post("register", { ...pending, password: "Wrong-Synthetic-Password-8296" });
    assert.equal(sql("SELECT count(*) AS n FROM firebase_local_actions")[0].n, before);
    await anonymous.post("register", pending);
    await anonymous.post("verify-email", { token: oldToken }, 400);
    await anonymous.post("verify-email", { token: mailToken(pending.email, "verify-email") });
    assert.equal(sql("SELECT count(*) AS n FROM firebase_local_links")[0].n, 3);
  });
  await check("Username login issues only opaque HttpOnly cookies and encrypted UID-bound D1 provider sessions", async () => {
    const result = await alice.login(aliceData.username); assert.equal(result.next, "/groups");
    const sessionCookie = alice.lastSetCookies.find((line) => line.startsWith("okuma_session="));
    assert.match(sessionCookie, /; HttpOnly/i); assert.match(sessionCookie, /; SameSite=Lax/i); assert.match(sessionCookie, /; Path=\//i);
    assert.equal(Object.keys(result).some((key) => /firebase|token|credential/i.test(key)), false);
    await bob.login(bobData.username);
    assert.equal(/^fb1\.[a-f0-9]{64}$/.test(alice.cookies.get("okuma_session")), true);
    const stored = sql("SELECT token_hash,sealed_credentials FROM firebase_local_sessions");
    assert.equal(stored.length, 2);
    assert.equal(stored.some((row) => JSON.stringify(row).includes("idToken") || JSON.stringify(row).includes("refreshToken") || JSON.stringify(row).includes(password)), false);
    assert.deepEqual((await (await alice.request("/api/groups")).json()).groups, []);
    await alice.request("/api/state", { expected: 403 });
    await anonymous.login("not-a-user", password, 401);
    await anonymous.login(aliceData.username, "Wrong-Synthetic-Password-8426", 401);
  });
  await check("No UID/email match can attach an existing legacy identity or enable bootstrap fallback", async () => {
    await anonymous.post("register", { ...aliceData, username: "new.name" });
    assert.equal(sql("SELECT count(*) AS n FROM firebase_local_links")[0].n, 3);
    await alice.post("link-email", { email: "other@example.test", password }, 409);
    sql("INSERT INTO member_accounts(member_id,username,password_hash,password_salt,password_iterations) VALUES(1,'demo.multi','','',0)");
    sql("INSERT INTO account_profiles(member_id,email,verified_at,policy_version) VALUES(1,'legacy@example.test',1,'2026-10-17')");
    await anonymous.post("register", { ...aliceData, username: "legacy.claim", email: "legacy@example.test" });
    await assert.rejects(admin.getUserByEmail("legacy@example.test"), (error) => error.code === "auth/user-not-found");
    assert.equal(sql("SELECT count(*) AS n FROM firebase_local_links WHERE member_id=1")[0].n, 0);
    sql("DELETE FROM account_profiles WHERE member_id=1"); sql("DELETE FROM member_accounts WHERE member_id=1");
    assert.equal(createHash("sha256").update(JSON.stringify(sql("SELECT * FROM members WHERE id<=3 ORDER BY id"))).digest("hex"), legacyBefore);
  });
  await check("New Firebase account creates independent groups and retains group-specific roles and appearance", async () => {
    first = (await alice.post("create-group", { name: "Local Firebase Readers", requestKey: randomUUID() })).group;
    assert.equal(first.role, "super_admin"); await alice.select(first.id);
    const invite = await alice.post("invitations", { days: 1, maxUses: 2 });
    const joined = await bob.post("join-group", { token: invite.token }); assert.equal(joined.group.role, "member");
    await bob.select(first.id); await bob.post("invitations", {}, 403);
    second = (await alice.post("create-group", { name: "Local Second Readers", requestKey: randomUUID() })).group;
    await alice.select(second.id);
    await alice.request("/api/groups/appearance", { method: "PATCH", json: { scheme: "catalogue", mode: "dark" } });
    await alice.select(first.id);
    assert.equal((await (await alice.request("/api/state")).json()).readingGroup.scheme, "notebook");
    await alice.select(second.id);
    assert.equal((await (await alice.request("/api/state")).json()).readingGroup.scheme, "catalogue");
    await alice.select(first.id);
  });
  await check("Reauthentication for account-data requests does not create a spare Firebase session", async () => {
    const before = sql("SELECT count(*) AS n FROM firebase_local_sessions")[0].n;
    await alice.request("/api/account/experience", { method: "POST", json: { kind: "deletion", action: "request", password: "Wrong", confirmed: true }, expected: 400 });
    const requested = await (await alice.request("/api/account/experience", { method: "POST", json: { kind: "deletion", action: "request", password, confirmed: true } })).json();
    assert.equal(requested.deletion.status, "requested");
    const cancelled = await (await alice.request("/api/account/experience", { method: "POST", json: { kind: "deletion", action: "cancel", password } })).json();
    assert.equal(cancelled.deletion.status, "cancelled");
    assert.equal(sql("SELECT count(*) AS n FROM firebase_local_sessions")[0].n, before);
  });
  await check("Generic forgot-password route sends local-only reset mail and rejects replay/old Koru sessions", async () => {
    const known = await anonymous.post("forgot-password", { email: bobData.email });
    const unknown = await anonymous.post("forgot-password", { email: "missing@example.test" }); assert.deepEqual(known, unknown);
    resetToken = mailToken(bobData.email, "reset-password");
    await anonymous.post("reset-password", { token: resetToken, password: "short" }, 400);
    await anonymous.post("reset-password", { token: resetToken, password: nextPassword });
    await bob.request("/api/groups", { expected: 401 });
    await anonymous.post("reset-password", { token: resetToken, password: nextPassword }, 400);
    await bob.login(bobData.username, password, 401);
    await bob.login(bobData.username, nextPassword); await bob.select(first.id);
  });
  await check("Security-tab password change preserves the current browser and invalidates all older sessions", async () => {
    const stale = alice.clone();
    await alice.request("/api/auth/change-password", { method: "POST", json: { currentPassword: "Wrong", newPassword: nextPassword, confirmPassword: nextPassword }, expected: 400 });
    await alice.request("/api/auth/change-password", { method: "POST", json: { currentPassword: password, newPassword: nextPassword, confirmPassword: nextPassword } });
    await stale.request("/api/groups", { expected: 401 }); await alice.request("/api/groups");
    await anonymous.login(aliceData.username, password, 401);
  });
  await check("Logout invalidates the stored handle, not just the browser cookie", async () => {
    const stale = bob.clone(); await bob.request("/api/auth/logout", { method: "POST" });
    await stale.request("/api/groups", { expected: 401 });
  });
  await check("Actual login/register/security screens retain four schemes and light/dark at mobile/desktop widths", async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    context.setDefaultTimeout(20000); context.setDefaultNavigationTimeout(45000);
    await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage(); activePage = page;
    page.on("pageerror", (error) => browserErrors.push(error.name));
    await page.goto(origin + "/login");
    for (const width of [390, 1440]) for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) for (const mode of ["light", "dark"]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.evaluate(({ scheme, mode }) => { localStorage.setItem("kitapTahlilScheme", scheme); localStorage.setItem("kitapTahlilColorMode", mode); }, { scheme, mode });
      await page.goto(origin + "/login"); await hydrated(page, "username"); await page.locator(`html[data-scheme="${scheme}"][data-color-mode="${mode}"]`).waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.screenshot({ path: `${output}/login-${scheme}-${mode}-${width}.png`, animations: "disabled" });
      await page.goto(origin + "/register"); await hydrated(page, "email");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.screenshot({ path: `${output}/register-${scheme}-${mode}-${width}.png`, animations: "disabled" });
    }
    await page.goto(origin + "/login"); await hydrated(page, "username");
    await page.locator("#username").fill(aliceData.username); await page.locator("#password").fill(nextPassword);
    await Promise.all([page.waitForURL(/\/groups/), page.getByRole("button", { name: "Giriş yap", exact: true }).click()]);
    assert.equal(await page.evaluate(() => Object.keys(localStorage).some((key) => /firebase|idtoken|refreshtoken/i.test(key))), false);
    await context.addCookies([...alice.cookies].map(([name, value]) => ({ name, value, url: origin, httpOnly: true, sameSite: "Lax" })));
    await alice.request("/api/account/experience", { method: "POST", json: { kind: "tour", version: 1, state: "dismissed" } });
    for (const width of [390, 1440]) for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) for (const mode of ["light", "dark"]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await alice.request("/api/groups/appearance", { method: "PATCH", json: { scheme, mode } });
      await page.goto(origin + "/"); await page.locator(`html[data-scheme="${scheme}"][data-color-mode="${mode}"]`).waitFor();
      await page.locator(".person-picker").waitFor();
      await page.waitForFunction(() => Object.keys(document.querySelector(".person-picker") || {}).some((key) => key.startsWith("__reactProps")));
      if (width === 390) await page.locator(".mobile-nav").getByRole("button", { name: "Profil", exact: true }).click();
      else await page.locator(".side-nav").getByRole("button", { name: "Profilim", exact: true }).click();
      await page.getByRole("tab", { name: "Güvenlik", exact: true }).click(); await page.locator(".profile-password-form").waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.screenshot({ path: `${output}/security-${scheme}-${mode}-${width}.png`, fullPage: true, animations: "disabled" });
    }
    const form = page.locator(".profile-password-form"), changedPassword = "Synthetic-UI-Password-3516!";
    await form.getByLabel("Mevcut şifre", { exact: true }).fill("Wrong-Synthetic-Password-8426");
    await form.getByLabel("Yeni şifre", { exact: true }).fill(changedPassword);
    await form.getByLabel("Yeni şifre tekrar", { exact: true }).fill(changedPassword);
    const submit = form.getByRole("button", { name: "Şifreyi değiştir", exact: true });
    let response = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/change-password");
    await submit.click(); assert.equal((await response).status(), 400);
    await form.locator('[role="alert"]').filter({ hasText: "doğrulanamadı" }).waitFor();
    await form.getByLabel("Mevcut şifre", { exact: true }).fill(nextPassword);
    response = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/change-password");
    await submit.click(); assert.equal((await response).status(), 200);
    await page.waitForFunction(() => document.querySelector('.profile-password-form input[autocomplete="current-password"]')?.value === "");
    await alice.request("/api/groups", { expected: 401 });
    alice.cookies = new Map((await context.cookies(origin)).map(({ name, value }) => [name, value]));
    alicePassword = changedPassword; await alice.request("/api/groups");
    assert.deepEqual(browserErrors, []); await context.close(); activePage = null;
  });
  await check("Provider-side revocation, disable and deletion reject existing Koru cookies without D1 version changes", async () => {
    await bob.login(bobData.username, nextPassword);
    const signin = await fetch(emulatorOrigin.origin + "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=synthetic-local-only", {
      method: "POST", redirect: "manual", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: bobData.email, password: nextPassword, returnSecureToken: true }), signal: AbortSignal.timeout(5000),
    });
    assert.equal(signin.status, 200); const credentials = await signin.json();
    const refresh = () => fetch(emulatorOrigin.origin + "/securetoken.googleapis.com/v1/token?key=synthetic-local-only", {
      method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: credentials.refreshToken }).toString(), signal: AbortSignal.timeout(5000),
    });
    const refreshed = await refresh(); assert.equal(refreshed.status, 200);
    const fresh = await refreshed.json(); assert.equal(fresh.project_id, "12345"); assert.equal(fresh.user_id, credentials.localId);
    const uid = sql("SELECT firebase_uid AS uid FROM firebase_local_links l JOIN member_accounts a ON a.member_id=l.member_id WHERE a.username='firebase.bob'")[0].uid;
    const version = sql("SELECT session_version AS n FROM member_accounts WHERE username='firebase.bob'")[0].n;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await admin.revokeRefreshTokens(uid);
    await bob.request("/api/groups", { expected: 401 });
    // The pinned emulator does not revoke refresh grants. Its refreshed ID
    // must still be denied by authoritative revocation verification.
    const revokedRefresh = await refresh(); assert.equal(revokedRefresh.status, 200);
    await assert.rejects(admin.verifyIdToken((await revokedRefresh.json()).id_token, true), (error) => error.code === "auth/id-token-revoked");
    assert.equal(sql("SELECT session_version AS n FROM member_accounts WHERE username='firebase.bob'")[0].n, version);
    await bob.login(bobData.username, nextPassword);
    await admin.updateUser(uid, { disabled: true });
    await bob.request("/api/groups", { expected: 401 });
    await admin.updateUser(uid, { disabled: false });
    await bob.login(bobData.username, nextPassword);
    await admin.deleteUser(uid);
    await bob.request("/api/groups", { expected: 401 });
    await bob.login(bobData.username, nextPassword, 401);
    assert.equal(sql("SELECT count(*) AS n FROM firebase_local_links")[0].n, 3);
  });
  await check("Ciphertext substitution, password-mutation freeze and canonical erasure freeze deny provider-valid sessions", async () => {
    const account = sql("SELECT member_id AS id,session_version AS version FROM member_accounts WHERE username='firebase.alice'")[0];
    const hash = createHash("sha256").update(alice.cookies.get("okuma_session").slice(4)).digest("hex");
    const original = sql(`SELECT sealed_credentials AS sealed FROM firebase_local_sessions WHERE token_hash='${hash}'`)[0].sealed;
    const other = sql("SELECT sealed_credentials AS sealed FROM firebase_local_sessions WHERE member_id<>" + account.id + " AND sealed_credentials<>'' LIMIT 1")[0];
    assert.ok(other);
    sql(`UPDATE firebase_local_sessions SET sealed_credentials='${other.sealed.replaceAll("'", "''")}' WHERE token_hash='${hash}'`);
    await alice.request("/api/groups", { expected: 401 });
    sql(`UPDATE firebase_local_sessions SET sealed_credentials='${original.replaceAll("'", "''")}' WHERE token_hash='${hash}'`);
    await alice.request("/api/groups");
    sql(`UPDATE firebase_local_links SET mutation_pending=1 WHERE member_id=${account.id}`);
    await alice.request("/api/groups", { expected: 401 });
    await anonymous.login(aliceData.username, alicePassword, 401);
    sql(`UPDATE firebase_local_links SET mutation_pending=0 WHERE member_id=${account.id}`);
    await alice.request("/api/groups");
    const id = randomUUID(), now = Date.now();
    sql(`INSERT INTO account_erasure_jobs(request_id,account_member_id,plan_json,plan_digest,created_at,updated_at) VALUES('${id}',${account.id},'{}','${"a".repeat(64)}',${now},${now})`);
    await alice.request("/api/groups", { expected: 401 });
    await anonymous.login(aliceData.username, alicePassword, 401);
    sql(`DELETE FROM account_erasure_jobs WHERE request_id='${id}'`);
    await alice.request("/api/groups");
  });
  await check("Real local provider outage returns 503 and never falls back to a legacy cookie or password", async () => {
    if (!process.send) throw Error("LOCAL_OWNED_PROCESS_CHANNEL_REQUIRED");
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error("LOCAL_EMULATOR_STOP_TIMEOUT")), 10000);
      process.once("message", (message) => {
        clearTimeout(timeout);
        if (message?.type === "owned-auth-emulator-stopped") resolve(); else reject(Error("LOCAL_EMULATOR_STOP_FAILED"));
      });
      process.send({ type: "stop-owned-auth-emulator" });
    });
    await alice.request("/api/groups", { expected: 503 });
    await anonymous.login(aliceData.username, alicePassword, 503);
  });
  passed = true;
} catch (error) {
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: `${output}/failure.png`, animations: "disabled" }).catch(() => {});
  failure = { check: current, operation, type: error.name, code: /^LOCAL_[A-Z0-9_]+$/.test(error.message) ? error.message : error.code || "CHECK_FAILED",
    browserPath: activePage && !activePage.isClosed() ? new URL(activePage.url()).pathname : undefined, browserErrors,
    frames: error.stack?.split("\n").slice(1).filter((line) => /test-firebase-local-integration\.mjs:\d+:\d+\)?$/.test(line)).map((line) => /test-firebase-local-integration\.mjs:\d+:\d+/.exec(line)[0]), privateDiagnosticsWithheld: true };
  console.error(JSON.stringify(failure)); process.exitCode = 1;
} finally {
  await browser?.close();
  await deleteApp(adminApp);
  writeFileSync(`${output}/report.json`, JSON.stringify({ status: passed ? "passed" : "failed", checkedAt: new Date().toISOString(),
    scope: "isolated-local-Koru-Worker-D1-and-Auth-Emulator-only", runId: testRunId, checks, failure,
    remoteAccountsTouched: false, realEmailSent: false, productionDeployed: false }, null, 2));
}
