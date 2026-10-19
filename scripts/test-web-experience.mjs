import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { chromium } from "playwright";
import { readGroupsDevelopmentSettings } from "./groups-development.mjs";
import { groupsConfigPath, groupsStatePath, testOrigin as origin, testOutputPath, testRunId } from "./test-environment.mjs";
import { localTestSql } from "./local-d1-test.mjs";

if (!testRunId) throw new Error("Only a named, isolated local fixture environment is allowed.");
const output = testOutputPath("web-experience");
mkdirSync(output, { recursive: true });
const checks = [], screenshots = [], browserErrors = [];
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const contexts = [];
const endpoint = "/api/account/experience";
const { password } = readGroupsDevelopmentSettings();
const suffix = Date.now().toString(36);
const extra = process.argv.includes("--extra");
if (process.argv.slice(2).some((arg) => arg !== "--extra")) throw new Error("Only --extra is supported.");
function sql(command) { return localTestSql({ config: groupsConfigPath, persistTo: groupsStatePath, command }); }
function passed(label) { checks.push(label); console.log(`EXPERIENCE: ${label}`); }
async function context() {
  const value = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  contexts.push(value); return value;
}
async function post(client, body, expected = 200, headers = {}) {
  const response = await client.request.post(origin + endpoint, { data: body, headers: { Origin: origin, ...headers } });
  assert.equal(response.status(), expected, `Account operation expected ${expected}, received ${response.status()}`);
  if (response.headers()["content-type"]?.includes("application/json")) {
    assert.ok(response.headers()["cache-control"]?.includes("no-store"));
    return response.json();
  }
  assert.equal(expected, 403, "Only the framework's early CSRF rejection may be non-JSON");
  return { rejected: true };
}
async function login(client, username) {
  const response = await client.request.post(origin + "/api/auth/login", { data: { username, password }, headers: { Origin: origin } });
  assert.equal(response.status(), 200);
}
async function fixture(name) {
  const username = `experience.${name}.${suffix}`;
  sql(`INSERT INTO members(name, role) VALUES ('Deneme ${name}', 'member');
    INSERT INTO member_accounts(member_id, username, password_hash, password_salt, password_iterations)
      SELECT last_insert_rowid(), '${username}', password_hash, password_salt, password_iterations FROM member_accounts WHERE username = 'demo.multi';
    INSERT INTO account_profiles(member_id, email, verified_at, policy_version)
      SELECT member_id, '${username}@example.test', 1, 'fixture' FROM member_accounts WHERE username = '${username}';
    INSERT INTO reading_group_memberships(account_member_id, group_id, member_id)
      SELECT member_id, 'default', member_id FROM member_accounts WHERE username = '${username}';`);
  const client = await context(); await login(client, username);
  return { client, username };
}
async function ready(page) {
  await page.waitForFunction(() => Object.keys(document.querySelector(".person-picker") || {}).some((key) => key.startsWith("__reactProps")));
  await page.waitForFunction(() => document.querySelector(".person-picker strong")?.textContent?.includes("Deneme"));
  await page.evaluate(() => document.fonts.ready);
}
async function replay(page) {
  await page.getByRole("button", { name: "Hesap menüsü", exact: true }).click();
  await page.getByRole("menuitem", { name: "İlk adımlar", exact: true }).click();
  await page.locator(".experience-dialog").waitFor();
}
async function profile(page, requireForm = true) {
  if (await page.locator(".mobile-nav").isVisible()) await page.locator(".mobile-nav").getByRole("button", { name: "Profil", exact: true }).click();
  else await page.locator(".side-nav").getByRole("button", { name: "Profilim", exact: true }).click();
  await page.getByRole("tab", { name: "Güvenlik", exact: true }).click();
  await page.locator(requireForm ? ".account-data-form" : ".account-data-section").waitFor();
}
async function extraChecks() {
  const bootstrap = await context(); await login(bootstrap, "demo.multi");
  const noGroup = await context(); await login(noGroup, "demo.none");
  const accountPage = await noGroup.newPage();
  await accountPage.goto(origin + "/account");
  await accountPage.getByRole("heading", { name: "Hesabım", exact: true }).waitFor();
  await accountPage.locator(".account-data-form").waitFor();
  assert.ok(await accountPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await accountPage.close();
  passed("Account data-request page remains available without group membership");
  const ui = await fixture("extra");
  const page = await ui.client.newPage();
  page.on("pageerror", () => browserErrors.push("Unhandled browser exception"));
  await page.goto(origin + "/"); await ready(page);
  await page.getByRole("button", { name: "Daha sonra", exact: true }).click();
  await page.locator(".experience-dialog").waitFor({ state: "hidden" });
  await profile(page);
  const form = page.locator(".account-data-form");
  await form.locator('input[type="password"]').fill(password);
  await form.locator('input[type="checkbox"]').check();
  await form.getByRole("button", { name: "Silme talebi gönder", exact: true }).click();
  await page.getByText("Talebin alındı", { exact: true }).waitFor();
  const request = (await (await ui.client.request.get(origin + endpoint)).json()).deletion;
  assert.equal(request.status, "requested");
  assert.equal(await form.locator('input[type="password"]').inputValue(), "");
  await form.locator('input[type="password"]').fill(password);
  await form.getByRole("button", { name: "Silme talebini iptal et", exact: true }).click();
  await page.getByText("Talebin iptal edildi", { exact: true }).waitFor();
  assert.equal(await form.locator('input[type="password"]').inputValue(), "");
  passed("Real data-request form sends and cancels a request, clears its password and renders server-confirmed status");
  for (const width of [390, 1440]) for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) for (const mode of ["light", "dark"]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const response = await ui.client.request.patch(origin + "/api/groups/appearance", { headers: { Origin: origin, "X-Reading-Group": "default" }, data: { scheme, mode } });
    assert.equal(response.status(), 200);
    await page.reload(); await ready(page); await profile(page);
    await page.locator(`html[data-scheme="${scheme}"][data-color-mode="${mode}"]`).waitFor();
    await page.locator(".account-data-section").scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const heading = await page.locator(".account-data-section .profile-section-heading").boundingBox();
    const content = await page.locator(".account-data-content").boundingBox();
    if (width === 1440) assert.ok(content.x >= heading.x + heading.width - 1);
    else assert.ok(content.y >= heading.y + heading.height - 1);
    const image = `${output}/data-final-${width}-${scheme}-${mode}.png`;
    await page.screenshot({ path: image, animations: "disabled", fullPage: true }); screenshots.push(image);
  }
  passed("Final data-request ledger layout and persisted cancellation state: 4 schemes x 2 modes x desktop/mobile");
  await post(ui.client, { kind: "deletion", action: "request", password, confirmed: true });
  sql(`UPDATE account_deletion_requests SET status = 'processing' WHERE id = '${request.id}'`);
  await post(ui.client, { kind: "deletion", action: "cancel", password }, 409);
  await page.reload(); await ready(page); await profile(page, false);
  await page.getByText("Talebin inceleniyor", { exact: true }).waitFor();
  assert.equal(await page.locator(".account-data-form").count(), 0);
  passed("Processing requests cannot be cancelled by bypassing the hidden form");
  const race = await fixture("race");
  const [left, right] = await Promise.all([post(race.client, { kind: "deletion", action: "request", password, confirmed: true }), post(race.client, { kind: "deletion", action: "request", password, confirmed: true })]);
  assert.equal(left.deletion.id, right.deletion.id);
  passed("Concurrent retries allocate one deletion request");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".mobile-nav").getByRole("button", { name: "Plan", exact: true }).click();
  await page.getByRole("button", { name: "Kitap öner", exact: true }).click();
  const dialog = page.locator(".create-dialog");
  await dialog.locator("input").first().focus();
  await page.evaluate(() => {
    Object.defineProperties(visualViewport, { height: { configurable: true, value: 430 }, offsetTop: { configurable: true, value: 30 } });
    visualViewport.dispatchEvent(new Event("resize"));
  });
  await page.locator("html[data-keyboard-open]").waitFor();
  const rectangle = await dialog.boundingBox();
  assert.ok(rectangle.y >= 30 && rectangle.y + rectangle.height <= 460);
  await dialog.locator('button[type="submit"]').scrollIntoViewIfNeeded();
  const button = await dialog.locator('button[type="submit"]').boundingBox();
  assert.ok(button.y >= 30 && button.y + button.height <= 460);
  await page.screenshot({ path: `${output}/keyboard-dialog-simulation.png`, animations: "disabled" });
  await page.evaluate(() => { delete visualViewport.height; delete visualViewport.offsetTop; visualViewport.dispatchEvent(new Event("resize")); });
  passed("Keyboard-occluded dialog and its final action fit the simulated visible viewport");
  // Only the fresh synthetic namespace is touched; always restore even on failure.
  sql("ALTER TABLE account_experience RENAME TO account_experience_fixture_backup");
  try {
    assert.deepEqual(await (await ui.client.request.get(origin + endpoint)).json(), { available: false });
    assert.equal((await ui.client.request.get(origin + "/api/state")).status(), 200);
  } finally { sql("ALTER TABLE account_experience_fixture_backup RENAME TO account_experience"); }
  passed("A pre-migration schema disables only the new tools, not existing state/group access");
  sql(`UPDATE member_accounts SET session_version = session_version + 1 WHERE username = '${race.username}'`);
  assert.equal((await race.client.request.get(origin + endpoint)).status(), 401);
  passed("New account endpoint also rejects a revoked session");
}
try {
  if (extra) await extraChecks();
  else {
  const config = await (await fetch(origin + "/api/onboarding/config")).json();
  assert.equal(config.enabled, true); assert.equal(config.local, true);
  const bootstrap = await context(); await login(bootstrap, "demo.multi");
  const anonymous = await context();
  assert.equal((await anonymous.request.get(origin + endpoint)).status(), 401);
  const { client, username } = await fixture("account");
  const initial = await (await client.request.get(origin + endpoint + "?memberId=1")).json();
  assert.equal(initial.available, true); assert.equal(initial.tourEligible, true); assert.equal(initial.tour, null); assert.equal(initial.deletion, null);
  await post(client, { kind: "tour", version: 1, state: "completed" }, 403, { Origin: "https://evil.example" });
  await post(client, { kind: "tour", version: 999, state: "completed" }, 400);
  await post(client, { padding: "x".repeat(9000) }, 413);
  await post(client, { kind: "unexpected" }, 400);
  passed("Account tools require authentication, same origin, bounded JSON and a supported operation/version");
  await post(client, { kind: "tour", version: 1, state: "completed", memberId: 1, groupId: "second" });
  const stored = await (await client.request.get(origin + endpoint, { headers: { "X-Reading-Group": "second" } })).json();
  assert.deepEqual(stored.tour, { version: 1, state: "completed" });
  assert.equal(sql("SELECT count(*) AS count FROM account_experience WHERE member_id = 1")[0].count, 0);
  passed("Tour state belongs to the canonical account, not supplied member/group identifiers");
  for (const name of ["İ".repeat(101), "Koru\u0000Grubu"]) {
    const response = await client.request.post(origin + "/api/onboarding/create-group", { headers: { Origin: origin }, data: { name, requestKey: crypto.randomUUID() } });
    assert.equal(response.status(), 400);
  }
  passed("Direct API requests cannot bypass the existing 100-character group name/control-character limit");
  await post(client, { kind: "deletion", action: "request", password, confirmed: false }, 400);
  await post(client, { kind: "deletion", action: "request", password: "Incorrect-password-123", confirmed: true }, 400);
  const request = await post(client, { kind: "deletion", action: "request", password, confirmed: true, memberId: 1 });
  const retry = await post(client, { kind: "deletion", action: "request", password, confirmed: true });
  assert.equal(request.deletion.id, retry.deletion.id); assert.equal(request.deletion.status, "requested");
  assert.equal(request.deletion.requestedAt, retry.deletion.requestedAt);
  assert.equal(sql("SELECT count(*) AS count FROM account_deletion_requests WHERE member_id = 1")[0].count, 0);
  assert.equal((await client.request.get(origin + "/api/groups")).status(), 200);
  assert.equal(sql(`SELECT count(*) AS count FROM member_accounts WHERE username = '${username}'`)[0].count, 1);
  passed("Deletion requires consent and fresh password proof; retries retain one request and do not falsely delete the account");
  const cancelled = await post(client, { kind: "deletion", action: "cancel", password });
  assert.equal(cancelled.deletion.status, "cancelled");
  // Invalid confirmation consumed a password-attempt bucket too: the next attempt must be blocked.
  await post(client, { kind: "deletion", action: "cancel", password }, 429);
  passed("Requests can be cancelled and repeated password operations are rate limited");
  const other = await fixture("other");
  const unrelated = await (await other.client.request.get(origin + endpoint + "?memberId=1")).json();
  assert.equal(unrelated.deletion, null);
  await post(other.client, { kind: "deletion", action: "cancel", password, memberId: 1, id: request.deletion.id }, 409);
  assert.equal((await (await client.request.get(origin + endpoint)).json()).deletion.status, "cancelled");
  passed("Another account cannot read or cancel a supplied victim/request identifier");
  const noGroup = await context(); await login(noGroup, "demo.none");
  assert.equal((await noGroup.request.get(origin + endpoint)).status(), 200);
  passed("Data rights remain reachable without any group membership");

  const ui = await fixture("ui");
  const page = await ui.client.newPage();
  page.on("pageerror", () => browserErrors.push("Unhandled browser exception"));
  await page.goto(origin + "/"); await ready(page);
  await page.locator(".experience-dialog").waitFor();
  await page.getByRole("button", { name: "Planı aç", exact: true }).click();
  assert.equal(await page.locator(".roadmap-page").isVisible(), true);
  await page.getByRole("button", { name: "Buluşmaları aç", exact: true }).click();
  await page.getByRole("button", { name: "Profilimi aç", exact: true }).click();
  await page.getByRole("button", { name: "Tamamla", exact: true }).click();
  await page.locator(".experience-dialog").waitFor({ state: "hidden" });
  await page.reload(); await ready(page);
  assert.equal(await page.locator(".experience-dialog").count(), 0);
  passed("First-use tour navigates real views and completion survives a new page load");
  for (const width of [390, 1440]) for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) for (const mode of ["light", "dark"]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const response = await ui.client.request.patch(origin + "/api/groups/appearance", { headers: { Origin: origin, "X-Reading-Group": "default" }, data: { scheme, mode } });
    assert.equal(response.status(), 200);
    await page.reload(); await ready(page);
    await page.locator(`html[data-scheme="${scheme}"][data-color-mode="${mode}"]`).waitFor();
    await replay(page);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const dialog = await page.locator(".experience-dialog").boundingBox();
    assert.ok(dialog.x >= 0 && dialog.x + dialog.width <= width + 1);
    let image = `${output}/tour-${width}-${scheme}-${mode}.png`;
    await page.screenshot({ path: image, animations: "disabled" }); screenshots.push(image);
    await page.getByRole("button", { name: "Daha sonra", exact: true }).click();
    await page.locator(".experience-dialog").waitFor({ state: "hidden" });
    await profile(page);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const form = page.locator(".account-data-form");
    assert.ok((await form.getByRole("button", { name: "Silme talebi gönder", exact: true }).boundingBox()).height >= 44);
    if (width === 390) assert.ok(await form.locator('input[type="password"]').evaluate((element) => parseFloat(getComputedStyle(element).fontSize) >= 16));
    image = `${output}/data-${width}-${scheme}-${mode}.png`;
    await page.screenshot({ path: image, animations: "disabled", fullPage: true }); screenshots.push(image);
    passed(`New tour and data controls: ${width}px ${scheme} ${mode}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const current = page.locator('.profile-password-form input[type="password"]').nth(0);
  await current.fill("Unsaved-current-password");
  await page.locator('.profile-password-form input[type="password"]').nth(1).fill("Unsaved-new-password-7429");
  await page.locator('.profile-password-form input[type="password"]').nth(2).fill("Unsaved-new-password-7429");
  let writes = 0;
  const observe = (request) => { if (request.method() !== "GET" && request.url().startsWith(origin + "/api/")) writes++; };
  page.on("request", observe);
  await ui.client.setOffline(true);
  await page.locator(".web-connection-status").waitFor();
  await page.getByRole("button", { name: "Şifreyi değiştir", exact: true }).click();
  assert.equal(writes, 0);
  assert.equal(await current.inputValue(), "Unsaved-current-password");
  assert.equal(await page.locator(".account-data-form button").isDisabled(), true);
  await ui.client.setOffline(false);
  await page.locator(".web-connection-status").waitFor({ state: "hidden" });
  await page.waitForTimeout(500);
  assert.equal(writes, 0); assert.equal(await current.inputValue(), "Unsaved-current-password");
  page.off("request", observe);
  passed("Offline submission is blocked, form values survive and reconnect does not replay a write");
  await current.focus();
  await page.evaluate(() => {
    Object.defineProperties(window.visualViewport, { height: { configurable: true, value: 430 }, offsetTop: { configurable: true, value: 30 } });
    visualViewport.dispatchEvent(new Event("resize"));
  });
  await page.locator("html[data-keyboard-open]").waitFor();
  assert.equal(await page.locator(".mobile-nav").isVisible(), false);
  assert.equal(await current.inputValue(), "Unsaved-current-password");
  await page.screenshot({ path: `${output}/keyboard-simulation.png`, animations: "disabled" });
  await page.evaluate(() => { delete visualViewport.height; delete visualViewport.offsetTop; visualViewport.dispatchEvent(new Event("resize")); });
  await page.locator("html:not([data-keyboard-open])").waitFor();
  passed("Visual-viewport keyboard simulation keeps form state and removes the obstructing bottom navigation (not a physical keyboard test)");
  assert.ok(statSync("public/reading-room.webp").size < 200_000);
  const geometry = await page.evaluate(async () => {
    const result = [];
    for (const src of ["/reading-room.png", "/reading-room.webp"]) { const image = new Image(); image.src = src; await image.decode(); result.push([image.naturalWidth, image.naturalHeight]); }
    return result;
  });
  assert.deepEqual(geometry[0], geometry[1]);
  passed("Optimized room asset decodes with identical geometry and stays below 200 KB");
  }
  assert.deepEqual(browserErrors, []);
  writeFileSync(`${output}/${extra ? "extra-" : ""}report.json`, JSON.stringify({ status: "passed", checkedAt: new Date().toISOString(), checks, screenshots, browserErrors, limitations: ["Local Chromium; physical installed Android/iPhone keyboard and airplane mode remain pending", "Deletion request is not completed data erasure", "Prior unaffected tests reused, not rerun"] }, null, 2));
  console.log(`Experience checks passed: ${checks.length}; screenshots: ${screenshots.length}`);
} finally {
  for (const client of contexts) await client.close();
  await browser.close();
}
