import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium, request } from "playwright";
import { groupsSettingsPath, testOrigin, testOutputPath, testAndroidPackage } from "./test-environment.mjs";

const serial = process.env.OKUMA_ANDROID_SERIAL || "emulator-5554";
const binary = join(process.env.ANDROID_HOME || join(homedir(), "Android/Sdk"), "platform-tools/adb");
const origin = testOrigin;
const packageName = testAndroidPackage;
const { password } = JSON.parse(readFileSync(groupsSettingsPath, "utf8"));
const output = testOutputPath("android-shell");
mkdirSync(output, { recursive: true });
const adb = (...args) => execFileSync(binary, ["-s", serial, ...args], { encoding: "utf8", timeout: 30_000 });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const evidence = [];
let browser;
let web;

async function attach() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const pid = adb("shell", "pidof", packageName).trim().split(/\s+/)[0];
      assert.match(pid, /^\d+$/);
      adb("forward", "tcp:9222", `localabstract:webview_devtools_remote_${pid}`);
      browser = await chromium.connectOverCDP("http://127.0.0.1:9222", { noDefaults: true, timeout: 3000 });
      const page = browser.contexts()[0]?.pages()[0];
      if (page) {
        page.setDefaultTimeout(25_000);
        page.setDefaultNavigationTimeout(40_000);
        return page;
      }
      await browser.close();
    } catch { /* WebView is still being created after the activity resumes. */ }
    await pause(500);
  }
  throw new Error("Android WebView did not become available.");
}
async function click(locator) { await locator.click({ noWaitAfter: true }); }
async function screenshot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  const geometry = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollWidth, scheme: document.documentElement.dataset.scheme, mode: document.documentElement.dataset.colorMode }));
  assert.ok(geometry.scroll <= geometry.width + 1, `${name}: horizontal overflow`);
  await page.screenshot({ path: `${output}/${name}.png`, animations: "disabled" });
  evidence.push({ name, ...geometry });
}
async function nativeScreenshot(name) {
  const png = execFileSync(binary, ["-s", serial, "exec-out", "screencap", "-p"], { timeout: 20_000, maxBuffer: 10 * 1024 * 1024 });
  writeFileSync(`${output}/${name}.png`, png);
}
async function choose(page, group) {
  await click(page.getByRole("button", { name: group === "default" ? /Okuma Halkasi/ : /İkinci Okuma Grubu/ }));
  await page.locator("main.content").waitFor();
  await page.waitForFunction(() => document.querySelector(".featured-book-card, .meeting-head"));
}
async function login(page) {
  await page.waitForFunction(() => {
    const input = document.getElementById("username");
    return input && Object.keys(input).some((key) => key.startsWith("__reactProps"));
  });
  await page.getByLabel("Kullanıcı adı", { exact: true }).fill("demo.multi");
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await click(page.getByRole("button", { name: "Giriş yap", exact: true }));
  await page.getByRole("heading", { name: "Grubunu seç", exact: true }).waitFor();
  await page.getByRole("button", { name: /Okuma Halkasi/ }).waitFor();
}
async function nativeFetch(page, path, method = "GET", body, group = "default") {
  return page.evaluate(async ({ path, method, body, group }) => {
    const response = await fetch(path, {
      method, headers: { "Content-Type": "application/json", "X-Reading-Group": group },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  }, { path, method, body, group });
}
async function chooser(name) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const activities = adb("shell", "dumpsys", "activity", "activities");
    if (/(?:topResumedActivity|mResumedActivity|ResumedActivity):.*(?:ChooserActivity|ResolverActivity)/.test(activities)) {
      await pause(800);
      await nativeScreenshot(name);
      adb("shell", "input", "keyevent", "4");
      return;
    }
    await pause(300);
  }
  throw new Error(`${name}: native chooser did not open`);
}

try {
  assert.equal(adb("shell", "getprop", "sys.boot_completed").trim(), "1");
  const webPort = new URL(origin).port;
  const metroPort = process.env.OKUMA_METRO_PORT || "8081";
  adb("reverse", `tcp:${webPort}`, `tcp:${webPort}`);
  adb("reverse", `tcp:${metroPort}`, `tcp:${metroPort}`);
  adb("shell", "am", "start", "-n", `${packageName}/.MainActivity`);
  let page = await attach();
  await page.waitForURL((url) => url.origin === origin);
  assert.equal(new URL(page.url()).origin, origin, "Native tests require the isolated local development origin.");
  await page.goto(origin + "/login");
  if (new URL(page.url()).pathname !== "/login") {
    await nativeFetch(page, "/api/auth/logout", "POST");
    await page.goto(origin + "/login");
  }
  assert.equal(await page.evaluate(() => !!window.ReactNativeWebView), true);
  await login(page);
  await screenshot(page, "group-selection");
  await choose(page, "default");
  await page.getByRole("button", { name: "Yeni buluşma oluştur", exact: true }).waitFor();

  for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) {
    for (const mode of ["light", "dark"]) {
      console.log(`Android ${scheme} ${mode}`);
      assert.equal((await nativeFetch(page, "/api/groups/appearance", "PATCH", { scheme, mode })).status, 200);
      await page.goto(origin + "/?group=default");
      await page.locator(`html[data-scheme="${scheme}"][data-color-mode="${mode}"]`).waitFor();
      await page.locator(".featured-book-card").waitFor();
      await screenshot(page, `${scheme}-${mode}-home`);
      await click(page.locator(".mobile-nav").getByRole("button", { name: "Buluşmalar", exact: true }));
      await screenshot(page, `${scheme}-${mode}-archive`);
      await click(page.locator(".mobile-nav").getByRole("button", { name: "Plan", exact: true }));
      await screenshot(page, `${scheme}-${mode}-plan`);
      await page.goto(origin + "/?meeting=1&group=default");
      await page.locator(".participation-card").waitFor();
      await screenshot(page, `${scheme}-${mode}-meeting`);
      await click(page.locator(".mobile-nav").getByRole("button", { name: "Profil", exact: true }));
      for (const tab of ["Özet", "Kitaplarım", "Galerim", "Görünüm", "Güvenlik", "Yüz verisi", "Çöp kutusu", "Yönetim"]) {
        await click(page.getByRole("tab", { name: tab, exact: true }));
        await screenshot(page, `${scheme}-${mode}-profile-${tab.replace(/[^a-zA-Z0-9]/g, "_")}`);
      }
    }
  }
  await nativeFetch(page, "/api/groups/appearance", "PATCH", { scheme: "notebook", mode: "system" });
  await page.goto(origin + "/?meeting=1&group=default");
  await page.locator(".meeting-head").waitFor();
  console.log("Android system theme and back navigation");
  adb("shell", "cmd", "uimode", "night", "yes");
  await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
  await screenshot(page, "system-dark-meeting");
  adb("shell", "cmd", "uimode", "night", "no");
  await page.waitForFunction(() => !document.documentElement.classList.contains("dark"));
  await click(page.getByRole("button", { name: "Kayıtlarda ara", exact: true }));
  await page.getByRole("dialog").waitFor();
  const locationBeforeBack = page.url();
  adb("shell", "input", "keyevent", "4");
  await pause(350);
  // The first back event belongs to the IME when the search input opens the keyboard.
  if (await page.getByRole("dialog").isVisible()) adb("shell", "input", "keyevent", "4");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(page.url(), locationBeforeBack, "Android back must close a modal before navigating");
  await click(page.getByRole("button", { name: "Buluşmayı paylaş", exact: true }));
  await chooser("native-meeting-share");
  await click(page.getByRole("link", { name: "Takvime ekle" }));
  await chooser("native-calendar-share");
  console.log("Android large file streaming");
  const largeSize = 21 * 1024 * 1024;
  const largeName = `large-bridge-${Date.now()}.zip`;
  await page.evaluate(async ({ largeSize, largeName }) => {
    const { saveFile } = await import("/lib/native-bridge.ts");
    window.exportProbe = "running";
    void saveFile(new Blob([new Uint8Array(largeSize).fill(77)], { type: "application/zip" }), largeName)
      .then(() => { window.exportProbe = "done"; }, (error) => { window.exportProbe = "error:" + error.message; });
  }, { largeSize, largeName });
  await chooser("native-large-file-share");
  await page.waitForFunction(() => window.exportProbe === "done");
  const hash = adb("shell", "run-as", packageName, "find", "cache/okuma-exports", "-name", largeName, "-exec", "sha256sum", "{}", "+").trim().split(/\s+/)[0];
  assert.equal(hash, createHash("sha256").update(Buffer.alloc(largeSize, 77)).digest("hex"), "Large file must arrive byte-for-byte intact");

  web = await request.newContext({ baseURL: origin });
  assert.equal((await web.post("/api/auth/login", { data: { username: "demo.multi", password } })).status(), 200);
  assert.equal((await web.post("/api/groups", { headers: { Origin: origin, "X-Reading-Group": "default" }, data: { groupId: "default" } })).status(), 200);
  const favorite = page.locator(".meeting-title-actions .favorite");
  const previousFavorite = (await favorite.getAttribute("class")).includes("active");
  const saved = page.waitForResponse((response) => response.url().includes("/api/action") && response.request().method() === "POST");
  await click(favorite);
  assert.equal((await saved).status(), 200);
  const state = await (await web.get("/api/state", { headers: { "X-Reading-Group": "default" } })).json();
  assert.equal(state.favorites.some((item) => item.memberId === 1 && item.bookId === 1), !previousFavorite);

  await click(page.locator(".rating-grid").getByRole("button", { name: "8", exact: true }));
  await page.locator("#comment").fill("Unsaved Android comment");
  adb("shell", "input", "keyevent", "3");
  adb("shell", "am", "start", "-n", `${packageName}/.MainActivity`);
  assert.equal(await page.locator("#comment").inputValue(), "Unsaved Android comment");
  await page.locator("#comment").fill("Synthetic review");
  await click(page.locator(".mobile-nav").getByRole("button", { name: "Profil", exact: true }));
  await click(page.getByRole("button", { name: "Grup değiştir", exact: true }));
  await choose(page, "second");
  await page.getByRole("heading", { name: "İkinci Grup Kitabı", exact: true }).first().waitFor();
  assert.equal(await page.getByRole("button", { name: "Yeni buluşma oluştur", exact: true }).count(), 0);
  await screenshot(page, "second-group-member");

  await browser.close(); browser = undefined;
  adb("shell", "am", "force-stop", packageName);
  adb("shell", "am", "start", "-n", `${packageName}/.MainActivity`);
  await pause(1200);
  page = await attach();
  await page.getByRole("heading", { name: "İkinci Grup Kitabı", exact: true }).first().waitFor();
  await screenshot(page, "persistent-session-second-group");
  assert.equal(new URL(page.url()).pathname, "/");

  await browser.close(); browser = undefined;
  adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", "okumahalkasi://meeting/1?group=default", "-p", packageName);
  await pause(1200);
  page = await attach();
  await page.getByRole("heading", { name: "Grubunu seç", exact: true }).waitFor();
  await choose(page, "default");
  await page.locator(".meeting-head h1").waitFor();
  assert.equal(await page.locator(".meeting-head h1").innerText(), "Birinci Grup Kitabı");
  await screenshot(page, "deep-link-meeting");
  await nativeScreenshot("native-screen-final");
  writeFileSync(`${output}/report.json`, JSON.stringify({ date: new Date().toISOString(), serial, evidence, checks: ["native login", "group roles", "theme matrix", "modal back", "system share", "ICS export", "web sync", "unsaved resume", "group switch", "persistent session", "group deep link"] }, null, 2));
  console.log(`Android native flows and ${evidence.length} screenshot/layout checks passed.`);
} finally {
  if (web) await web.dispose();
  if (browser) await browser.close();
}
