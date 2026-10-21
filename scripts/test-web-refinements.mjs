import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { readGroupsDevelopmentSettings } from "./groups-development.mjs";
import { groupsConfigPath, groupsStatePath, testOrigin as origin, testOutputPath, testRunId } from "./test-environment.mjs";
import { localTestSql } from "./local-d1-test.mjs";
import { checkMeetingLayout } from "./meeting-layout-checks.mjs";
import { checkEmptyPanelContrast } from "./empty-panel-checks.mjs";
import { checkGroupHero } from "./group-hero-checks.mjs";
import { checkMobileDialogs } from "./mobile-dialog-checks.mjs";

if (!testRunId) throw Error("A named isolated local fixture is required.");
const output = testOutputPath("web-refinements"), checks = [], screenshots = [], errors = [], meetingLayouts = [], emptyPanels = [];
let groupHero = null, mobileDialogs = [];
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
  await page.getByText("Henüz bir okuma grubuna üye değilsin.", { exact: true }).waitFor();
  assert.equal(await page.locator(".experience-dialog").count(), 0);
  await capture("first-account-before-group");
  await page.getByRole("link", { name: "Grup kur veya katıl", exact: true }).click();
  await hydrated('[role="tab"]');
  await page.getByRole("tab", { name: "Grup kur", exact: true }).click();
  const groupName = page.getByLabel("Okuma grubu adı", { exact: true });
  await groupName.fill("İlk Okuma Grubum");
  assert.equal(await page.locator(".experience-dialog").count(), 0);
  const failCreation = route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Test: grup kurulamadı." }) });
  await page.route("**/api/onboarding/create-group", failCreation);
  await page.getByRole("button", { name: "Okuma grubu oluştur", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.locator(".experience-dialog").count(), 0);
  assert.equal((await (await context.request.get(origin + "/api/account/experience")).json()).tour, null);
  assert.equal((await (await context.request.get(origin + "/api/groups")).json()).groups.length, 0);
  await page.unroute("**/api/onboarding/create-group", failCreation);
  await page.getByRole("button", { name: "Okuma grubu oluştur", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/"); await hydrated();
  await page.locator(".app-shell.view-home .empty-panel h3").waitFor();
  await page.getByRole("heading", { name: "Okuma grubun", exact: true }).waitFor();
  assert.equal(await page.locator(".experience-dialog").getByText("İlk Okuma Grubum", { exact: true }).isVisible(), true);
  const firstGroup = (await (await context.request.get(origin + "/api/groups")).json()).selectedGroupId;
  assert.ok(firstGroup);
  await capture("first-group-home-tour");
  await page.getByRole("button", { name: "Planı aç", exact: true }).click();
  await page.locator(".roadmap-page").waitFor();
  await page.getByRole("button", { name: "Buluşmaları aç", exact: true }).click();
  await page.locator(".app-shell.view-archive").waitFor();
  await page.getByRole("button", { name: "Profilimi aç", exact: true }).click();
  await page.locator(".app-shell.view-profile").waitFor();
  await page.getByRole("button", { name: "Görünümünü seç", exact: true }).click();
  const appearance = page.locator(".appearance-welcome-dialog");
  await appearance.getByRole("heading", { name: "Görünümünü seç", exact: true }).waitFor();
  await appearance.getByRole("radio", { name: "Katalog", exact: true }).check();
  await appearance.getByRole("radio", { name: "Koyu", exact: true }).check();
  assert.equal(await page.locator("html").getAttribute("data-scheme"), "notebook", "Draft choice must not change the persisted theme");
  const failSave = async (route) => {
    if (route.request().method() === "POST" && route.request().postDataJSON()?.kind === "appearance") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Test: yeniden dene." }) });
    return route.continue();
  };
  await page.route("**/api/account/experience", failSave);
  await appearance.getByRole("button", { name: "Kaydet ve başla", exact: true }).click();
  await appearance.getByRole("alert").waitFor();
  assert.equal(await appearance.getByRole("radio", { name: "Katalog", exact: true }).isChecked(), true);
  assert.equal((await (await context.request.get(origin + "/api/account/experience")).json()).tour, null);
  await page.unroute("**/api/account/experience", failSave);
  await context.setOffline(true);
  const offlineNotice = appearance.getByText("Bağlantın yok. Görünümünü kaydetmek için yeniden bağlan.", { exact: true });
  await offlineNotice.waitFor();
  assert.equal(await appearance.getByRole("button", { name: "Kaydet ve başla", exact: true }).isEnabled(), false);
  await context.setOffline(false); await offlineNotice.waitFor({ state: "hidden" });
  assert.equal(await appearance.getByRole("radio", { name: "Katalog", exact: true }).isChecked(), true);
  await capture("first-account-appearance");
  await appearance.getByRole("button", { name: "Kaydet ve başla", exact: true }).click();
  await page.locator(".experience-dialog").waitFor({ state: "hidden" });
  await page.reload(); await hydrated();
  assert.equal(await page.locator(".experience-dialog").count(), 0);
  assert.deepEqual((await (await context.request.get(origin + "/api/account/experience")).json()).tour, { version: 1, state: "completed" });
  assert.deepEqual((await (await context.request.get(origin + "/api/account/experience")).json()).appearance, { scheme: "catalogue", mode: "dark" });
  await page.goto(origin + "/groups/manage"); await page.locator(".onboarding-actions").waitFor();
  assert.equal(await page.locator(".experience-dialog").count(), 0);
  const freshDevice = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    assert.equal((await freshDevice.request.post(origin + "/api/auth/login", { headers: { Origin: origin }, data: { username, password } })).status(), 200);
    const freshPage = await freshDevice.newPage(); await freshPage.goto(origin + "/groups");
    await freshPage.locator('.app-shell').waitFor();
    await freshPage.locator('html[data-scheme="catalogue"][data-color-mode="dark"]').waitFor();
    assert.equal(await freshPage.locator(".experience-dialog").count(), 0);
  } finally { await freshDevice.close(); }

  for (const width of [390, 1440]) for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) for (const mode of ["light", "dark"]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    assert.equal((await context.request.patch(origin + "/api/groups/appearance", { headers: { Origin: origin, "X-Reading-Group": firstGroup }, data: { scheme, mode } })).status(), 200);
    await page.goto(origin + "/?group=" + firstGroup); await hydrated();
    await page.locator(`html[data-scheme="${scheme}"][data-color-mode="${mode}"]`).waitFor();
    await page.getByRole("heading", { name: "Henüz bir buluşma yok", exact: true }).waitFor();
    emptyPanels.push(await checkEmptyPanelContrast(page, "home"));
    await capture(`${width}-${scheme}-${mode}-empty-home`);
    const nav = page.locator(width === 390 ? ".mobile-nav" : ".side-nav");
    await nav.getByRole("button", { name: "Buluşmalar", exact: true }).click();
    emptyPanels.push(await checkEmptyPanelContrast(page, "archive"));
    await capture(`${width}-${scheme}-${mode}-empty-archive`);
    await nav.getByRole("button", { name: width === 390 ? "Plan" : /Gelecek kitaplar|Plan/, exact: width === 390 }).click();
    emptyPanels.push(await checkEmptyPanelContrast(page, "roadmap"));
    await capture(`${width}-${scheme}-${mode}-empty-roadmap`);
  }
  assert.equal((await context.request.patch(origin + "/api/groups/appearance", { headers: { Origin: origin, "X-Reading-Group": firstGroup }, data: { scheme: "catalogue", mode: "dark" } })).status(), 200);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/groups/manage"); await page.locator(".onboarding-actions").waitFor();
  await page.getByRole("tab", { name: "Grup kur", exact: true }).click();
  await page.getByLabel("Okuma grubu adı", { exact: true }).fill("Görünüm Deneme Grubu");
  await page.getByRole("button", { name: "Okuma grubu oluştur", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/"); await hydrated();
  await page.locator('html[data-scheme="catalogue"][data-color-mode="dark"]').waitFor();
  assert.equal(await page.locator(".experience-dialog").count(), 0);
  const savedGroup = (await (await context.request.get(origin + "/api/groups")).json()).groups.find(group => group.id === firstGroup);
  assert.equal(savedGroup?.scheme, "catalogue"); assert.equal(savedGroup?.mode, "dark");
  passed("No tour before successful first-group creation; real home loads before the tour, failed creation does not consume it, explicit appearance save survives retry/offline/reload/device and new-group inheritance");
  passed("Empty home/archive/plan: readable dark text and icons in all four schemes at390/1440; existing light text colors unchanged");

  const joinedUsername = username + ".join";
  sql(`INSERT INTO members(name,role) VALUES('Davetli Okur','member');
    INSERT INTO member_accounts(member_id,username,password_hash,password_salt,password_iterations)
      SELECT last_insert_rowid(),'${joinedUsername}',password_hash,password_salt,password_iterations FROM member_accounts WHERE username='demo.multi';
    INSERT INTO account_profiles(member_id,email,verified_at,policy_version)
      SELECT member_id,'${joinedUsername}@example.test',1,'fixture' FROM member_accounts WHERE username='${joinedUsername}';`);
  assert.equal((await context.request.post(origin + "/api/groups", { headers: { Origin: origin, "X-Reading-Group": firstGroup }, data: { groupId: firstGroup } })).status(), 200);
  const inviteResponse = await context.request.post(origin + "/api/onboarding/invitations", { headers: { Origin: origin, "X-Reading-Group": firstGroup }, data: { days: 1, maxUses: 1 } });
  assert.equal(inviteResponse.status(), 200);
  const { token } = await inviteResponse.json();
  const joined = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  try {
    assert.equal((await joined.request.post(origin + "/api/auth/login", { headers: { Origin: origin }, data: { username: joinedUsername, password } })).status(), 200);
    const joinedPage = await joined.newPage(); joinedPage.on("pageerror", error => errors.push(error.message));
    await joinedPage.goto(origin + "/join#invite=" + token);
    const joinButton = joinedPage.getByRole("button", { name: "Gruba katıl", exact: true });
    await joinButton.waitFor(); await joinedPage.waitForFunction(() => !document.querySelector('button[type="submit"]')?.disabled);
    assert.equal(await joinedPage.locator(".experience-dialog").count(), 0);
    assert.equal((await (await joined.request.get(origin + "/api/account/experience")).json()).tour, null);
    await joinButton.click(); await joinedPage.waitForURL(url => url.pathname === "/");
    await joinedPage.locator(".app-shell.view-home .empty-panel h3").waitFor();
    await joinedPage.getByRole("heading", { name: "Okuma grubun", exact: true }).waitFor();
    await joinedPage.getByRole("button", { name: "Daha sonra", exact: true }).click();
    await joinedPage.locator(".experience-dialog").waitFor({ state: "hidden" });
    await joinedPage.reload(); await joinedPage.locator(".app-shell").waitFor();
    assert.equal((await (await joined.request.get(origin + "/api/account/experience")).json()).tour.state, "dismissed");
    assert.equal(await joinedPage.locator(".experience-dialog").count(), 0);
  } finally { await joined.close(); }
  passed("First invitation join also opens the tour only after real group home; dismissal remains account-wide on reload");

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

  mobileDialogs = await checkMobileDialogs(page, context, origin, capture);
  passed("All four actual form dialogs: no portal input auto-zoom, date/file/text overflow or unreachable save action across four schemes, both modes and320/390/430/1440; keyboard open/close preserves drafts");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/?group=default"); await hydrated();

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
    if (scheme !== "minimal") assert.ok(await page.locator(".hero").evaluate((element) => getComputedStyle(element).backgroundImage.includes("reading-room.webp")));
    await capture(`${width}-${scheme}-${mode}-home`);
    await page.getByRole("button", { name: "Yeni buluşma oluştur", exact: true }).click();
    await dialog.getByRole("radio", { name: "Çevrim içi", exact: true }).check();
    const geometry = await dialog.boundingBox(); assert.ok(geometry.x >= 0 && geometry.x + geometry.width <= width + 1);
    await capture(`${width}-${scheme}-${mode}-venue`);
    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
    await page.goto(origin + "/?meeting=1&group=default"); await page.locator(".gallery-card").waitFor(); await hydrated();
    meetingLayouts.push(await checkMeetingLayout(page));
    await capture(`${width}-${scheme}-${mode}-meeting-spacing`);
    for (const route of ["/groups", "/groups/manage"]) {
      await page.goto(origin + route); await page.locator(".onboarding-actions").waitFor();
      const boxes = await page.locator(".onboarding-actions a").evaluateAll((elements) => elements.map((element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, height: r.height }; }));
      assert.equal(boxes.length, 2); assert.ok(boxes.every((r) => r.height >= 44));
      assert.ok(boxes[1].x >= boxes[0].right + 7 || boxes[1].y >= boxes[0].bottom + 7, "Adjacent actions need visible separation");
      await capture(`${width}-${scheme}-${mode}-${route === "/groups" ? "selection" : "management"}`);
    }
  }
  passed("All four schemes in both modes and widths: meeting-section containment and desktop divider clearance, image fallback, venue controls, separated onboarding links and touch targets");
  for (const width of [900, 1024, 1280, 1920, 2560]) for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) for (const mode of ["light", "dark"]) {
    await page.setViewportSize({ width, height: 1100 });
    assert.equal((await context.request.patch(origin + "/api/groups/appearance", { headers, data: { scheme, mode } })).status(), 200);
    await page.goto(origin + "/?meeting=1&group=default"); await page.locator(".gallery-card").waitFor(); await hydrated();
    meetingLayouts.push(await checkMeetingLayout(page));
    await capture(`${width}-${scheme}-${mode}-meeting-spacing`);
  }
  passed("Tablet breakpoint and narrow/wide desktop meetings: all four themes and modes keep section controls clear of borders at900/1024/1280/1920/2560");
  await page.locator('.gallery-actions input[type="file"]').setInputFiles("public/brand/koru-192-v2.png");
  await page.getByRole("button", { name: "Albümü indir", exact: true }).waitFor();
  await page.locator(".photo-grid img").first().waitFor();
  for (const width of [390, 1024, 1440]) for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) for (const mode of ["light", "dark"]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
    assert.equal((await context.request.patch(origin + "/api/groups/appearance", { headers, data: { scheme, mode } })).status(), 200);
    await page.goto(origin + "/?meeting=1&group=default"); await hydrated(); await page.locator(".photo-grid img").first().waitFor();
    await page.getByRole("button", { name: "Albümü indir", exact: true }).waitFor();
    meetingLayouts.push(await checkMeetingLayout(page));
    await capture(`${width}-${scheme}-${mode}-populated-gallery-spacing`);
  }
  passed("Populated galleries keep both upload and album commands inside their section in all themes/modes at390/1024/1440");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/?group=default"); await hydrated();
  groupHero = await checkGroupHero(page, context, origin, capture);
  passed("Real desktop/mobile file choosers change actual picture pixels; custom/default hero rendering, reload and same-file replacement pass all schemes/modes");
  await page.setViewportSize({ width: 390, height: 844 });
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
  writeFileSync(`${output}/report.json`, JSON.stringify({ status: "passed", checkedAt: new Date().toISOString(), checks, screenshots, meetingLayouts, emptyPanels, groupHero, mobileDialogs, errors, limitations: ["Local Chromium and synthetic D1 only; no real provider mail or physical device acceptance"] }, null, 2));
  console.log(`Refinement checks passed: ${checks.length}; screenshots: ${screenshots.length}`);
} catch (error) {
  writeFileSync(`${output}/failed-${Date.now()}.json`, JSON.stringify({ status: "failed", checkedAt: new Date().toISOString(), checks, screenshots, meetingLayouts, emptyPanels, errors, failure: error.message }, null, 2));
  throw error;
} finally { await context.close(); await browser.close(); }
