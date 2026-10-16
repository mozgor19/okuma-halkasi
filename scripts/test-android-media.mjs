import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { unzipSync } from "fflate";

const serial = process.env.OKUMA_ANDROID_SERIAL || "emulator-5554";
const binary = join(process.env.ANDROID_HOME || join(homedir(), "Android/Sdk"), "platform-tools/adb");
const packageName = "com.okumahalkasi.app";
const origin = "http://127.0.0.1:5174";
const { password } = JSON.parse(readFileSync(".sites-runtime/groups-development.json", "utf8"));
const adb = (...args) => execFileSync(binary, ["-s", serial, ...args], { encoding: "utf8", timeout: 30_000 });
const pid = adb("shell", "pidof", packageName).trim().split(/\s+/)[0];
assert.match(pid, /^\d+$/);
adb("forward", "tcp:9222", `localabstract:webview_devtools_remote_${pid}`);
const browser = await chromium.connectOverCDP("http://127.0.0.1:9222", { noDefaults: true });
const page = browser.contexts()[0].pages()[0];
assert.equal(new URL(page.url()).origin, origin);
page.setDefaultTimeout(30_000);
mkdirSync("outputs/android-media", { recursive: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let photoId;
const modelRequests = [];
page.on("request", (req) => { if (req.url().includes("/face-models/")) modelRequests.push(req.url()); });
async function api(path, action) {
  return page.evaluate(async ({ path, action }) => {
    const response = await fetch(path, { method: action ? "POST" : "GET", headers: { "X-Reading-Group": "default", "Content-Type": "application/json" }, body: action ? JSON.stringify(action) : undefined });
    if (!response.ok) throw new Error("Native media API failed: " + response.status);
    return response.json();
  }, { path, action });
}
try {
  await page.evaluate(() => fetch("/api/auth/logout", { method: "POST" }));
  await page.goto(origin + "/login");
  await page.waitForFunction(() => {
    const input = document.getElementById("username");
    return input && Object.keys(input).some((key) => key.startsWith("__reactProps"));
  });
  await page.getByLabel("Kullanıcı adı", { exact: true }).fill("demo.multi");
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click({ noWaitAfter: true });
  await page.getByRole("button", { name: /Okuma Halkasi/ }).click({ noWaitAfter: true });
  await page.locator(".featured-book-card").waitFor();
  await page.evaluate(() => new Promise((resolve, reject) => {
    const deletion = indexedDB.deleteDatabase("tensorflowjs");
    deletion.onsuccess = () => resolve(true);
    deletion.onerror = () => reject(new Error("Model cache could not be reset"));
    deletion.onblocked = () => reject(new Error("Model cache is still in use"));
  }));
  await page.goto(origin + "/?meeting=1&group=default");
  await page.locator(".gallery-actions input[type=file]").waitFor({ state: "attached" });
  const before = await api("/api/state");
  assert.equal(before.readingGroup?.id, "default", "Run the Android shell suite first to establish the synthetic local session.");
  const beforeIds = new Set(before.photos.map((photo) => photo.id));
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jYfcAAAAASUVORK5CYII=", "base64");
  const uploaded = page.waitForResponse((response) => response.url().includes("/api/upload") && response.request().method() === "POST");
  await page.locator(".gallery-actions input[type=file]").setInputFiles({ name: "synthetic-photo.png", mimeType: "image/png", buffer: png });
  assert.equal((await uploaded).status(), 200);
  await page.waitForFunction(() => !document.querySelector('.gallery-actions input[type=file]')?.disabled, undefined, { timeout: 90_000 });
  const state = await api("/api/state");
  const photo = state.photos.find((item) => !beforeIds.has(item.id) && item.meetingId === 1);
  assert.ok(photo, "Image upload must persist a photo in the selected group");
  photoId = photo.id;
  const image = page.locator(`.photo-grid img[src*="${photo.mediaKey}"]`);
  await image.waitFor();
  await image.click({ noWaitAfter: true });
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: "outputs/android-media/lightbox.png", animations: "disabled" });
  adb("shell", "input", "keyevent", "4");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Albümü indir", exact: true }).click({ noWaitAfter: true });
  let opened = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (/(?:topResumedActivity|ResumedActivity):.*ChooserActivity/.test(adb("shell", "dumpsys", "activity", "activities"))) { opened = true; break; }
    await pause(300);
  }
  assert.ok(opened, "Native album sharing must open");
  await pause(1000);
  writeFileSync("outputs/android-media/album-share.png", execFileSync(binary, ["-s", serial, "exec-out", "screencap", "-p"], { maxBuffer: 10 * 1024 * 1024 }));
  const archivePath = adb("shell", "run-as", packageName, "find", "cache/okuma-exports", "-name", "*albumu.zip").trim().split("\n").filter(Boolean).at(-1);
  assert.ok(archivePath);
  const archive = execFileSync(binary, ["-s", serial, "exec-out", "run-as", packageName, "cat", archivePath]);
  const files = unzipSync(archive);
  assert.ok(Object.keys(files).length >= 1);
  assert.ok(Object.values(files).every((bytes) => bytes.length > 0));
  adb("shell", "input", "keyevent", "4");
  await api("/api/action", { action: "deletePhoto", photoId });
  photoId = undefined;
  const faceCount = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const { validateFaceReference } = await import("/lib/face-recognition.ts");
    return validateFaceReference(new Blob([bytes], { type: "image/png" }));
  }, png.toString("base64"));
  assert.equal(faceCount, 0, "A synthetic blank image must not become a face reference");
  assert.ok(modelRequests.length > 0);
  assert.ok(modelRequests.every((url) => new URL(url).origin === origin));
  writeFileSync("outputs/android-media/report.json", JSON.stringify({ date: new Date().toISOString(), checks: ["native photo upload", "persisted group media", "lightbox back", "native ZIP export", "ZIP contents", "photo deletion", "local face model loading", "blank face rejection"], archiveBytes: archive.length, faceCount, modelRequests: modelRequests.map((url) => new URL(url).pathname) }, null, 2));
  console.log("Android photo, gallery, ZIP export and local face-model negative test passed.");
} finally {
  if (photoId) await api("/api/action", { action: "deletePhoto", photoId }).catch(() => {});
  await browser.close();
}
