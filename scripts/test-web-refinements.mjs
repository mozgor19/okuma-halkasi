import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { readGroupsDevelopmentSettings } from "./groups-development.mjs";
import { groupsConfigPath, groupsStatePath, testOrigin as origin, testOutputPath, testRunId } from "./test-environment.mjs";
import { localTestSql } from "./local-d1-test.mjs";

if (!testRunId) throw Error("A named isolated local fixture is required.");
const output = testOutputPath("web-refinements"), checks = [], screenshots = [], errors = [];
mkdirSync(output, { recursive: true });
const { password } = readGroupsDevelopmentSettings();
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
context.setDefaultTimeout(30_000);
const page = await context.newPage(); page.on("pageerror", (error) => errors.push(error.message));
const sql = (command) => localTestSql({ config: groupsConfigPath, persistTo: groupsStatePath, command });
const passed = (name) => { checks.push(name); console.log("REFINEMENTS: " + name); };
const login = async (username) => {
  const response = await context.request.post(origin + "/api/auth/login", { headers: { Origin: origin }, data: { username, password } });
  assert.equal(response.status(), 200); return response.json();
};
async function capture(name) {
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ": document overflow");
  const image = `${output}/${name}.png`; await page.screenshot({ path: image, fullPage: true, animations: "disabled" }); screenshots.push(image);
}
async function hydrated(selector = ".person-picker") {
  await page.waitForFunction((selector) => Object.keys(document.querySelector(selector) || {}).some((key) => key.startsWith("__reactProps")), selector);
}
try {
  await login("demo.multi");
  const username = "refinements." + Date.now().toString(36);
  sql(`INSERT INTO members(name,role) VALUES('Yeni Okur','member');
    INSERT INTO member_accounts(member_id,username,password_hash,password_salt,password_iterations)
      SELECT last_insert_rowid(),'${username}',password_hash,password_salt,password_iterations FROM member_accounts WHERE username='demo.multi';
    INSERT INTO account_profiles(member_id,email,verified_at,policy_version)
      SELECT member_id,'${username}@example.test',1,'fixture' FROM member_accounts WHERE username='${username}';`);
  await login(username); await page.goto(origin + "/groups");
  await page.locator(".experience-dialog").waitFor();
  await page.getByRole("heading", { name: "Koru'ya hoş geldin", exact: true }).waitFor();
  await capture("first-account-tour");
  for (let step = 0; step < 3; step++) await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await page.getByRole("button", { name: "Başlayalım", exact: true }).click();
  await page.locator(".experience-dialog").waitFor({ state: "hidden" });
  await page.reload(); await page.locator(".onboarding-actions").waitFor();
  assert.equal(await page.locator(".experience-dialog").count(), 0);
  assert.deepEqual((await (await context.request.get(origin + "/api/account/experience")).json()).tour, { version: 1, state: "completed" });
  await page.goto(origin + "/groups/manage"); await page.locator(".onboarding-actions").waitFor();
  assert.equal(await page.locator(".experience-dialog").count(), 0);
  passed("First verified account with zero groups opens the tour automatically; completion survives reload");

  await login("demo.multi");
  assert.equal((await context.request.post(origin + "/api/groups", { headers: { Origin: origin, "X-Reading-Group": "default" }, data: { groupId: "default" } })).status(), 200);
  await page.goto(origin + "/?group=default"); await hydrated();
  // Compare the original light palette contract through the browser's CSS parser.
  const baseline = JSON.parse(readFileSync("scripts/fixtures/approved-light-palettes.json", "utf8"));
  const current = readFileSync("app/themes.css", "utf8");
  const palettes = await page.evaluate(({ baseline, current }) => {
    const extract = (source) => {
      const sheet = new CSSStyleSheet(); sheet.replaceSync(source);
      const tokens = {};
      const walk = (rules) => { for (const rule of rules) {
        if (rule.cssRules) walk(rule.cssRules);
        if (!rule.style || /\.dark|prefers-color-scheme/.test(rule.selectorText || "")) continue;
        for (const property of rule.style) if (property.startsWith("--app-") && !property.startsWith("--app-font")) tokens[rule.selectorText + "/" + property] = rule.style.getPropertyValue(property);
      } };
      walk(sheet.cssRules); return tokens;
    };
    return [baseline, extract(current)];
  }, { baseline, current });
  assert.deepEqual(palettes[1], palettes[0]); passed("All original non-dark --app palette declarations remain unchanged");

  await page.getByRole("button", { name: "Yeni buluşma oluştur", exact: true }).click();
  const dialog = page.locator(".create-dialog");
  await dialog.getByLabel("Kitap adı *", { exact: true }).fill("Çevrim İçi Deneme Kitabı");
  await dialog.getByLabel("Yazar *", { exact: true }).fill("Deneme Yazarı");
  await dialog.locator('input[name="date"]').fill("2028-10-20T19:00");
  await dialog.getByRole("radio", { name: "Çevrim içi", exact: true }).check();
  assert.equal(await dialog.locator('input[name="location"]').count(), 0);
  assert.equal(await dialog.locator('input[name="onlineUrl"]').getAttribute("required"), null);
  await capture("online-optional-link-mobile");
  await dialog.getByRole("button", { name: "Buluşmayı oluştur", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.locator(".meeting-online-access").waitFor();
  assert.equal(await page.getByRole("link", { name: "Toplantıya katıl", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Buluşmayı düzenle", exact: true }).click();
  await dialog.locator('input[name="onlineUrl"]').fill("https://meet.example/koru");
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("link", { name: "Toplantıya katıl", exact: true }).waitFor();
  await capture("online-meeting-mobile");
  passed("Real meeting forms create an online meeting without a link and later add a safe join link");
  const headers = { Origin: origin, "X-Reading-Group": "default" };
  const before = await (await context.request.get(origin + "/api/state", { headers })).json();
  const currentMeeting = before.meetings.find((meeting) => meeting.id === Number(new URL(page.url()).searchParams.get("meeting")));
  assert.ok(currentMeeting);
  await page.getByRole("button", { name: "Buluşmayı düzenle", exact: true }).click();
  await dialog.locator('input[name="onlineUrl"]').fill("https://meet.example/unsaved");
  assert.equal((await context.request.post(origin + "/api/action", { headers, data: { action: "editMeeting", meetingId: currentMeeting.id, revision: currentMeeting.revision, date: "2028-10-22T19:00", kind: "online", onlineUrl: "https://meet.example/other-editor" } })).status(), 200);
  let backgroundReads = 0;
  const observe = (request) => { if (new URL(request.url()).pathname === "/api/state") backgroundReads++; };
  page.on("request", observe);
  await page.evaluate(() => window.dispatchEvent(new Event("okuma:resume")));
  await page.waitForTimeout(350); page.off("request", observe);
  assert.equal(backgroundReads, 0, "Editing must suspend background state refresh");
  assert.equal(await dialog.locator('input[name="onlineUrl"]').inputValue(), "https://meet.example/unsaved");
  const conflicted = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/action");
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click(); assert.equal((await conflicted).status(), 409);
  await dialog.getByRole("alert").waitFor();
  assert.equal((await (await context.request.get(origin + "/api/state", { headers })).json()).meetings.find((meeting) => meeting.id === currentMeeting.id).onlineUrl, "https://meet.example/other-editor");
  await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
  passed("Editing suspends background refresh and keeps the draft; stale submission warns inside the dialog without overwriting another edit");

  for (const width of [390, 1440]) for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) for (const mode of ["light", "dark"]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    assert.equal((await context.request.patch(origin + "/api/groups/appearance", { headers: { Origin: origin, "X-Reading-Group": "default" }, data: { scheme, mode } })).status(), 200);
    await page.goto(origin + "/?group=default"); await hydrated();
    await page.locator(`html[data-scheme="${scheme}"][data-color-mode="${mode}"]`).waitFor();
    if (scheme === "notebook") assert.match(await page.locator(".notebook-hero-media img").getAttribute("src"), /reading-room.webp/);
    else if (scheme !== "minimal") assert.ok(await page.locator(".hero").evaluate((element) => getComputedStyle(element).backgroundImage.includes("reading-room.webp")));
    await capture(`${width}-${scheme}-${mode}-home`);
    await page.getByRole("button", { name: "Yeni buluşma oluştur", exact: true }).click();
    await dialog.getByRole("radio", { name: "Çevrim içi", exact: true }).check();
    const geometry = await dialog.boundingBox(); assert.ok(geometry.x >= 0 && geometry.x + geometry.width <= width + 1);
    await capture(`${width}-${scheme}-${mode}-venue`);
    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
    for (const route of ["/groups", "/groups/manage"]) {
      await page.goto(origin + route); await page.locator(".onboarding-actions").waitFor();
      const boxes = await page.locator(".onboarding-actions a").evaluateAll((elements) => elements.map((element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, height: r.height }; }));
      assert.equal(boxes.length, 2); assert.ok(boxes.every((r) => r.height >= 44));
      assert.ok(boxes[1].x >= boxes[0].right + 7 || boxes[1].y >= boxes[0].bottom + 7, "Adjacent actions need visible separation");
      await capture(`${width}-${scheme}-${mode}-${route === "/groups" ? "selection" : "management"}`);
    }
  }
  passed("All four schemes in both modes and widths: image fallback, venue controls, separated onboarding links and touch targets");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/?group=default"); await hydrated();
  await page.locator('.hero-image-tools input[type="file"]').setInputFiles("public/brand/koru-192-v2.png");
  await page.getByRole("button", { name: "Varsayılan grup görseline dön", exact: true }).waitFor();
  await capture("custom-group-image-mobile");
  await page.getByRole("button", { name: "Varsayılan grup görseline dön", exact: true }).click();
  await page.getByRole("button", { name: "Varsayılan grup görseline dön", exact: true }).waitFor({ state: "hidden" });
  passed("Admin image normalization/upload/reset completes through the actual home controls");
  sql(`INSERT INTO reading_group_memberships(account_member_id,group_id,member_id)
    SELECT member_id,'default',member_id FROM member_accounts WHERE username='${username}';`);
  await login(username);
  assert.equal((await context.request.post(origin + "/api/groups", { headers: { Origin: origin, "X-Reading-Group": "default" }, data: { groupId: "default" } })).status(), 200);
  await page.goto(origin + "/?notifications=1&group=default"); await hydrated();
  const preference = page.getByRole("switch", { name: "Buluşma değişikliği e-postaları", exact: true });
  await preference.waitFor(); assert.equal(await preference.isEnabled(), true); assert.equal(await preference.isChecked(), false);
  async function savePreference(enabled) {
    const saved = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/groups/notifications" && response.request().method() === "POST");
    await preference.click();
    const response = await saved; assert.equal(response.status(), 200);
    assert.equal((await response.json()).enabled, enabled);
    await page.waitForFunction((enabled) => {
      const input = document.querySelector('.meeting-mail-preference input');
      return input && !input.disabled && input.checked === enabled;
    }, enabled);
  }
  await savePreference(true);
  await page.reload(); await preference.waitFor();
  assert.equal(await preference.isChecked(), true);
  await savePreference(false);
  assert.equal(await page.locator(".meeting-mail-queue").count(), 0, "Regular members cannot inspect the queue");
  await capture("mail-preference-mobile");
  passed("Mail deep link opens profile; verified member toggles/persists opt-in and cannot inspect the admin queue");
  assert.deepEqual(errors, []);
  writeFileSync(`${output}/report.json`, JSON.stringify({ status: "passed", checkedAt: new Date().toISOString(), checks, screenshots, errors, limitations: ["Local Chromium and synthetic D1 only; no real provider mail or physical device acceptance"] }, null, 2));
  console.log(`Refinement checks passed: ${checks.length}; screenshots: ${screenshots.length}`);
} finally { await context.close(); await browser.close(); }
