import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { staging, stagingCredentialsPath, groups, stagingFailure } from "./staging-policy.mjs";
import { checkGroupTools } from "./group-tools-checks.mjs";
import { checkFooterLayout } from "./footer-layout-checks.mjs";

const origin = staging.origin;
const { accounts } = JSON.parse(readFileSync(stagingCredentialsPath, "utf8"));
const output = resolve("outputs/koru-staging", new Date().toISOString().replace(/[:.]/g, "-"));
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const checks = [], screenshots = [], errors = [];
function check(name, assertion) { assertion(); checks.push(name); }
async function login(page, account) {
  await page.goto(origin + "/login");
  await page.waitForFunction(() => Object.keys(document.getElementById("username") || {}).some((key) => key.startsWith("__reactProps")));
  await page.locator("#username").fill(account.username);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}
async function nav(page, name) {
  const root = page.locator(page.viewportSize().width < 768 ? ".mobile-nav" : ".side-nav");
  await root.getByRole("button", { name, exact: typeof name === "string" }).click();
}
async function capture(page, name) {
  await page.locator("main.content").waitFor();
  await page.evaluate(() => document.fonts.ready);
  const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.ok(geometry.scrollWidth <= geometry.width + 1, `Overflow: ${name}`);
  const missing = await page.locator("img:visible").evaluateAll((images) => images.filter((img) => img.complete && !img.naturalWidth).map((img) => img.getAttribute("src")));
  assert.deepEqual(missing, [], `Missing assets: ${name}`);
  await page.screenshot({ path: `${output}/${name}.png`, animations: "disabled" });
  screenshots.push({ name, ...geometry, footer: await checkFooterLayout(page) });
}

let context;
try {
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  context.setDefaultTimeout(30_000);
  context.setDefaultNavigationTimeout(60_000);
  context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
  const request = context.request;
  const config = await (await request.get(origin + "/api/onboarding/config")).json();
  check("Restricted test onboarding requires real mail, private allowlist and Turnstile", () => { assert.equal(config.enabled, true); assert.equal(config.ready, true); assert.equal(config.local, false); assert.equal(config.restrictedTest, true); assert.ok(config.siteKey); assert.equal(config.brand, "Koru"); assert.equal(config.supportEmail, "koru.destek@gmail.com"); assert.equal(config.privacyUrl, origin + "/privacy"); assert.equal(config.termsUrl, origin + "/terms"); assert.equal(JSON.stringify(config).includes("deneme1"), false); });
  for (const path of ["/register", "/forgot-password", "/reset-password", "/join", "/privacy", "/terms", "/support"]) {
    const response = await request.get(origin + path);
    check(`Public test page: ${path}`, () => assert.equal(response.status(), 200));
  }
  const noChallenge = await request.post(origin + "/api/onboarding/register", { headers: { Origin: origin }, data: { email: "not-allowed@example.com", challenge: "" } });
  check("Public registration cannot bypass real Turnstile", () => assert.equal(noChallenge.status(), 400));
  const crossSite = await request.post(origin + "/api/onboarding/forgot-password", { headers: { Origin: "https://other.example.com" }, data: { email: "not-allowed@example.com" } });
  check("Cross-origin recovery rejected", () => assert.equal(crossSite.status(), 403));
  const anonymous = await request.get(origin + "/api/state");
  check("Anonymous users cannot read group data", () => assert.equal(anonymous.status(), 401));
  const page = await context.newPage();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const path of ["privacy", "terms", "support"]) {
      await page.goto(`${origin}/${path}`);
      await page.getByText(/Mustafa Özgör/).first().waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: `${output}/${width}-${path}.png`, animations: "disabled", fullPage: true });
      screenshots.push({ name: `${width}-${path}` });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const loginResponse = await page.goto(origin + "/login");
  check("Staging does not permit search indexing", () => assert.match(loginResponse.headers()["x-robots-tag"] || "", /noindex/));
  await page.getByRole("heading", { name: "Koru", exact: true }).waitFor();
  const previewTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
  const previewImage = await page.locator('meta[property="og:image"]').getAttribute("content");
  check("HTTPS public preview has a stable corporate title and absolute image", () => { assert.equal(previewTitle,"Koru"); assert.equal(previewImage,origin + "/brand/koru-share-v1.png"); });
  check("HTTPS login has baseline browser security headers", () => { assert.equal(loginResponse.headers()["x-content-type-options"],"nosniff"); assert.equal(loginResponse.headers()["referrer-policy"],"no-referrer"); assert.equal(loginResponse.headers()["x-frame-options"],"DENY"); });
  const manifest = await request.get(origin + "/koru.webmanifest");
  check("HTTPS manifest is public, correctly typed and independent of membership", () => { assert.equal(manifest.status(),200); assert.match(manifest.headers()["content-type"],/application\/(?:manifest\+)?json/); });
  assert.equal((await manifest.json()).name,"Koru");
  const worker = await request.get(origin + "/koru-sw.js");
  check("HTTPS worker is public, correctly typed and never stale-cached", () => { assert.equal(worker.status(),200); assert.match(worker.headers()["content-type"],/(?:java|ecma)script/); assert.match(worker.headers()["cache-control"],/no-store/); });
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL.endsWith("/koru-sw.js"));
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith("/koru-sw.js"));
  await context.setOffline(true);
  let offlineVisible = false;
  try {
    await page.goto(origin + "/");
    await page.getByRole("heading", { name:"Bağlantı yok",exact:true }).waitFor();
    offlineVisible = true;
    await page.screenshot({ path:`${output}/pwa-offline.png` });
    screenshots.push({ name:"pwa-offline" });
  } finally { await context.setOffline(false); }
  check("HTTPS active service worker provides a generic offline shell", () => assert.equal(offlineVisible,true));
  await login(page, accounts[1]);
  check("Single group account opens home directly", () => assert.equal(new URL(page.url()).pathname, "/"));
  await page.getByRole("heading", { name: "Birinci Grup Kitabi", exact: true }).first().waitFor();
  const denied = await request.post(origin + "/api/groups", { headers: { Origin: origin, "X-Reading-Group": groups[1].id }, data: { groupId: groups[1].id } });
  check("Single group account cannot select another group", () => assert.equal(denied.status(), 403));
  await page.goto(origin + "/groups/manage");
  await page.getByText(`@${accounts[1].username}`, { exact: true }).waitFor();
  await page.getByRole("tab", { name: "Grup kur", exact: true }).click();
  await page.getByLabel("Okuma grubu adı").fill("Yetkisiz Grup Testi");
  const creationDisabled = await page.getByRole("button", { name: "Okuma grubu oluştur", exact: true }).isDisabled();
  check("Unverified fixture cannot create a group; its current username is visible", () => assert.equal(creationDisabled, true));
  await page.getByRole("button", { name: "Hesap durumunu yenile", exact: true }).click();
  await page.getByRole("link", { name: "Grup kurmak veya davetle katılmak için e-postanı doğrula.", exact: true }).waitFor();
  assert.equal(await page.getByLabel("Okuma grubu adı").inputValue(), "Yetkisiz Grup Testi");
  await page.screenshot({ path: `${output}/390-account-status.png`, animations: "disabled", fullPage: true });
  screenshots.push({ name: "390-account-status" });
  await page.getByRole("link", { name: "Grup kurmak veya davetle katılmak için e-postanı doğrula.", exact: true }).click();
  await page.getByText(`@${accounts[1].username}`, { exact: true }).waitFor();
  await page.getByRole("button", { name: "Çıkış yap", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/login");
  const profileAfterLogout = await request.get(origin + "/api/onboarding/account");
  check("Account screen logout removes access to its profile", () => assert.equal(profileAfterLogout.status(), 401));
  await login(page, accounts[0]);
  check("Multiple groups require a selection after login", () => assert.equal(new URL(page.url()).pathname, "/groups"));
  await page.getByRole("button", { name: new RegExp(groups[0].name) }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.locator(".app-shell").waitFor();
  let state = await (await request.get(origin + "/api/state", { headers: { "X-Reading-Group": groups[0].id } })).json();
  check("First group resolves its local identity and admin role", () => { assert.equal(state.currentMemberId, 1); assert.equal(state.members.find((member) => member.id === state.currentMemberId).role, "super_admin"); assert.equal(state.books[0].title, "Birinci Grup Kitabi"); });
  await nav(page, "Profil");
  await page.getByRole("button", { name: "Grup değiştir" }).click();
  await page.getByRole("button", { name: new RegExp(groups[1].name) }).click();
  await page.waitForURL((url) => url.searchParams.get("group") === groups[1].id);
  await page.getByRole("heading", { name: "Ikinci Grup Kitabi", exact: true }).first().waitFor();
  state = await (await request.get(origin + "/api/state", { headers: { "X-Reading-Group": groups[1].id } })).json();
  check("Profile switching changes data, local identity and permissions", () => { assert.equal(state.currentMemberId, 7); assert.equal(state.members.find((member) => member.id === state.currentMemberId).role, "member"); assert.equal(state.books[0].title, "Ikinci Grup Kitabi"); assert.equal(state.books.some((book) => book.title === "Birinci Grup Kitabi"), false); });
  await page.locator('html[data-scheme="catalogue"][data-color-mode="dark"]').waitFor();
  const selectedTitle = await page.title();
  check("Second group restores its own appearance and name", () => assert.equal(selectedTitle, groups[1].name));
  const stale = await request.get(origin + "/api/state", { headers: { "X-Reading-Group": groups[0].id } });
  check("Stale group request is rejected", () => assert.equal(stale.status(), 409));
  await request.post(origin + "/api/groups", { headers: { Origin: origin, "X-Reading-Group": groups[0].id }, data: { groupId: groups[0].id } });

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) {
      for (const mode of ["light", "dark"]) {
        const appearance = await request.patch(origin + "/api/groups/appearance", { headers: { Origin: origin, "X-Reading-Group": groups[0].id }, data: { scheme, mode } });
        assert.equal(appearance.status(), 200);
        await page.goto(`${origin}/?group=${groups[0].id}`);
        await page.locator(`html[data-scheme="${scheme}"][data-color-mode="${mode}"]`).waitFor();
        await page.getByRole("heading", { name: "Birinci Grup Kitabi", exact: true }).first().waitFor();
        const prefix = `${width}-${scheme}-${mode}`;
        await capture(page, `${prefix}-home`);
        await nav(page, width < 768 ? "Plan" : /Gelecek kitaplar|Plan/);
        await capture(page, `${prefix}-plan`);
        await page.goto(`${origin}/?meeting=1&group=${groups[0].id}`);
        await page.locator(".participation-card").waitFor();
        await capture(page, `${prefix}-meeting`);
        await nav(page, width < 768 ? "Profil" : "Profilim");
        const invitationList = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/onboarding/invitations" && response.request().method() === "GET");
        await page.getByText("Davetleri yönet", { exact: true }).click();
        assert.equal((await invitationList).status(), 200);
        await page.waitForFunction(() => {
          const records = document.querySelector(".invitation-records");
          return records?.getAttribute("aria-busy") === "false" && records.querySelector(".invitation-empty:not([role]),.invitation-list li");
        });
        assert.equal(await page.locator('.group-invitations [role="alert"]').count(), 0);
        await checkGroupTools(page);
        checks.push(`Group tools loaded with readable controls: ${prefix}`);
        await capture(page, `${prefix}-group-tools`);
        await page.getByText("Davetleri yönet", { exact: true }).click();
        const tabs = scheme === "notebook" ? ["Özet", "Kitaplarım", "Galerim", "Görünüm", "Güvenlik", "Yüz verisi", "Çöp kutusu", "Yönetim"] : ["Özet", "Güvenlik"];
        for (const tab of tabs) {
          await page.getByRole("tab", { name: tab, exact: true }).click();
          if (tab === "Güvenlik") {
            assert.equal(await page.getByRole("button", { name: "Şifreyi değiştir", exact: true }).isEnabled(), true);
            assert.equal(await page.getByRole("link", { name: "Şifremi unuttum", exact: true }).getAttribute("href"), "/forgot-password");
            const heights = await page.locator('.profile-password-form input,.profile-password-form button[type="submit"],.profile-password-recovery').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
            assert.equal(heights.length, 5);
            assert.ok(heights.every((height) => height >= 44));
            checks.push(`Security form is actionable and links to email recovery: ${prefix}`);
          }
          await capture(page, `${prefix}-profile-${tabs.indexOf(tab)}`);
        }
        await page.getByRole("tab", { name: "Güvenlik", exact: true }).click();
        await page.setViewportSize({ width, height: 1600 });
        await capture(page, `${prefix}-short-page-footer`);
        if (width === 1440 && scheme === "notebook") {
          await page.setViewportSize({ width: 2557, height: 1262 });
          await capture(page, `2557-${scheme}-${mode}-short-page-footer`);
        }
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        console.log(`Staging UI passed: ${width}px ${scheme} ${mode}`);
      }
    }
  }
  assert.deepEqual(errors, []);
  writeFileSync(`${output}/report.json`, JSON.stringify({ origin, date: new Date().toISOString(), passed: true, checks, screenshots, errors }, null, 2));
  console.log(`Staging passed ${checks.length} workflow/security checks and ${screenshots.length} screenshots. Report: ${output}/report.json`);
} catch (error) {
  const message = stagingFailure(error);
  writeFileSync(`${output}/report.json`, JSON.stringify({ origin, date: new Date().toISOString(), passed: false, checks, screenshots, errors, failure: message }, null, 2));
  console.error(message);
  process.exitCode = 1;
} finally {
  if (context) {
    await context.request.post(origin + "/api/groups", { headers: { Origin: origin, "X-Reading-Group": groups[0].id }, data: { groupId: groups[0].id } }).catch(() => {});
    await context.request.patch(origin + "/api/groups/appearance", { headers: { Origin: origin, "X-Reading-Group": groups[0].id }, data: { scheme: "notebook", mode: "light" } }).catch(() => {});
    await context.request.post(origin + "/api/auth/logout", { headers: { Origin: origin } }).catch(() => {});
    await context.close();
  }
  await browser.close();
}
