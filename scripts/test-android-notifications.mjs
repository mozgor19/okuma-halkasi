import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const serial = process.env.OKUMA_ANDROID_SERIAL || "emulator-5554";
assert.match(serial, /^emulator-\d+$/, "Permission-state tests are restricted to emulators.");
const binary = join(process.env.ANDROID_HOME || join(homedir(), "Android/Sdk"), "platform-tools/adb");
const packageName = "com.okumahalkasi.app";
const origin = "http://127.0.0.1:5174";
const { password } = JSON.parse(readFileSync(".sites-runtime/groups-development.json", "utf8"));
const adb = (...args) => execFileSync(binary, ["-s", serial, ...args], { encoding: "utf8", timeout: 10_000 });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync("outputs/android-notifications", { recursive: true });
let browser;
async function attach() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const pid = adb("shell", "pidof", packageName).trim().split(/\s+/)[0];
      assert.match(pid, /^\d+$/);
      adb("forward", "tcp:9222", `localabstract:webview_devtools_remote_${pid}`);
      browser = await chromium.connectOverCDP("http://127.0.0.1:9222", { noDefaults: true, timeout: 2000 });
      const page = browser.contexts()[0].pages()[0];
      if (page) { page.setDefaultTimeout(30_000); return page; }
      await browser.close();
    } catch { /* Wait for the notification intent to create a WebView. */ }
    await pause(500);
  }
  throw new Error("Android notification target did not open.");
}
async function tapNode(page, selector) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      adb("shell", "uiautomator", "dump", "--compressed", "/sdcard/okuma-test-window.xml");
      const xml = adb("exec-out", "cat", "/sdcard/okuma-test-window.xml");
      const bounds = await page.evaluate(({ xml, selector }) => {
        const node = new DOMParser().parseFromString(xml, "application/xml").querySelector(selector);
        return node?.getAttribute("bounds");
      }, { xml, selector });
      if (bounds) {
        const [left, top, right, bottom] = bounds.match(/\d+/g).map(Number);
        assert.ok(right > left && bottom > top);
        adb("shell", "input", "tap", String(Math.floor((left + right) / 2)), String(Math.floor((top + bottom) / 2)));
        return;
      }
    } catch { /* System transitions may temporarily have no idle accessibility tree. */ }
    await pause(300);
  }
  throw new Error("Native control not found: " + selector);
}
async function screenshot(name) {
  writeFileSync(`outputs/android-notifications/${name}.png`, execFileSync(binary, ["-s", serial, "exec-out", "screencap", "-p"], { maxBuffer: 10 * 1024 * 1024 }));
}
async function permission(page) {
  return page.evaluate(async () => {
    const { nativeNotificationPermission } = await import("/lib/native-bridge.ts");
    return nativeNotificationPermission();
  });
}
async function resetNotificationPermission() {
  if (browser) { await browser.close(); browser = undefined; }
  adb("shell", "am", "force-stop", packageName);
  adb("shell", "pm", "revoke", packageName, "android.permission.POST_NOTIFICATIONS");
  adb("shell", "pm", "clear-permission-flags", packageName, "android.permission.POST_NOTIFICATIONS", "user-set", "user-fixed");
  // Reset Expo's asked-before cache as well as Android's flags, only on the test emulator.
  adb("shell", "run-as", packageName, "rm", "-f", "shared_prefs/expo.modules.permissions.asked.xml");
  adb("shell", "am", "start", "-n", packageName + "/.MainActivity");
  const page = await attach();
  await page.goto(origin + "/?group=default");
  await page.waitForFunction(() => window.__okumaShell?.notifications === true);
  return page;
}
async function openNotifications(page) {
  await page.locator(".featured-book-card").waitFor();
  await page.waitForFunction(() => {
    const button = document.querySelector('[aria-label="Bildirimler"]');
    return button && Object.keys(button).some((key) => key.startsWith("__reactProps"));
  });
  await page.getByRole("button", { name: "Bildirimler", exact: true }).click({ noWaitAfter: true });
  await page.locator(".notification-menu").waitFor();
}
async function login(page, username) {
  await page.evaluate(() => fetch("/api/auth/logout", { method: "POST" }));
  await page.goto(origin + "/login");
  await page.waitForFunction(() => {
    const input = document.getElementById("username");
    return input && Object.keys(input).some((key) => key.startsWith("__reactProps"));
  });
  await page.getByLabel("Kullanıcı adı", { exact: true }).fill(username);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click({ noWaitAfter: true });
  if (username === "demo.multi") await page.getByRole("button", { name: /Okuma Halkasi/ }).click({ noWaitAfter: true });
  await page.locator(".featured-book-card").waitFor();
}
try {
  adb("shell", "cmd", "statusbar", "collapse");
  let page = await attach();
  assert.equal(new URL(page.url()).origin, origin);
  await login(page, "demo.multi");
  page = await resetNotificationPermission();
  assert.equal(await permission(page), "default");
  console.log("Checking first permission refusal");
  await openNotifications(page);
  await page.getByRole("button", { name: "Cihaz bildirimlerini aç", exact: true }).click({ noWaitAfter: true });
  await tapNode(page, '[resource-id$="/permission_deny_button"]');
  assert.equal(await permission(page), "default", "Android permits asking again after the first refusal");
  await page.getByText("Bildirim izni verilmedi.", { exact: true }).waitFor();
  adb("shell", "pm", "set-permission-flags", packageName, "android.permission.POST_NOTIFICATIONS", "user-set", "user-fixed");
  await page.reload();
  await openNotifications(page);
  assert.equal(await permission(page), "denied");
  await page.getByText("Bildirim izni cihaz ayarlarından kapalı.", { exact: true }).waitFor();
  await screenshot("permission-denied");
  console.log("Permission denial and permanently denied state passed");

  page = await resetNotificationPermission();
  await openNotifications(page);
  await page.getByRole("button", { name: "Cihaz bildirimlerini aç", exact: true }).click({ noWaitAfter: true });
  await screenshot("permission-prompt");
  await tapNode(page, '[resource-id$="/permission_allow_button"]');
  assert.equal(await permission(page), "granted");
  console.log("Permission grant passed");
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith("book-club-notified-default-2-")) localStorage.removeItem(key);
  });
  await login(page, "demo.single");
  await page.waitForFunction(() => Object.keys(localStorage).some((key) => key.startsWith("book-club-notified-default-2-") && localStorage.getItem(key) === "1"));
  const expected = await page.evaluate(async () => {
    const key = Object.keys(localStorage).find((key) => key.startsWith("book-club-notified-default-2-") && localStorage.getItem(key) === "1");
    const meetingId = Number(key.match(/-(?:new|upcoming)-(\d+)$/)[1]);
    const state = await (await fetch("/api/state", { headers: { "X-Reading-Group": "default" } })).json();
    const meeting = state.meetings.find((item) => item.id === meetingId);
    return { meetingId, title: state.books.find((item) => item.id === meeting.bookId).title };
  });
  console.log("Native notification delivered through the existing notification center");
  adb("shell", "input", "keyevent", "3");
  await pause(1000);
  const oldPid = adb("shell", "pidof", packageName).trim().split(/\s+/)[0];
  assert.match(oldPid, /^\d+$/);
  adb("shell", "run-as", packageName, "kill", "-9", oldPid);
  await pause(500);
  assert.throws(() => adb("shell", "pidof", packageName), "The notification must survive a stopped app process");
  adb("shell", "cmd", "statusbar", "expand-notifications");
  await pause(1000);
  // Use a separate browser only to parse the system accessibility XML after app termination.
  const parserBrowser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const parser = await parserBrowser.newPage();
    await screenshot("notification-drawer");
    await tapNode(parser, `[text*=${JSON.stringify(expected.title)}]`);
  } finally { await parserBrowser.close(); }
  await browser.close(); browser = undefined;
  page = await attach();
  await page.locator(".meeting-head h1").waitFor();
  assert.equal(await page.locator(".meeting-head h1").innerText(), expected.title);
  assert.equal(new URL(page.url()).searchParams.get("meeting"), String(expected.meetingId));
  assert.equal(new URL(page.url()).searchParams.get("group"), "default");
  await screenshot("notification-cold-start-meeting");
  await login(page, "demo.multi");
  writeFileSync("outputs/android-notifications/report.json", JSON.stringify({ date: new Date().toISOString(), checks: ["permission denial", "denial feedback", "permission grant", "notification center delivery", "notification retained with process stopped", "notification tap", "cold start group/meeting navigation"] }, null, 2));
  console.log("Android notification permission, delivery and cold-start meeting navigation passed.");
} finally { if (browser) await browser.close(); }
