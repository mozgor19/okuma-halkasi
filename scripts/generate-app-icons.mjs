import { copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = root + "public/favicon.svg";
const chromeCandidates = [
  process.env.CHROME_BIN,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
].filter(Boolean);
const chrome = chromeCandidates.find(existsSync);

if (!chrome) throw new Error("CHROME_BIN ayarlayın veya Chromium yükleyin.");

for (const [size, name] of [[180, "notebook-apple-touch-icon.png"], [192, "notebook-icon-192.png"], [512, "notebook-icon-512.png"]]) {
  const output = root + "public/icons/" + name;
  const result = spawnSync(chrome, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    "--force-device-scale-factor=1", "--window-size=" + size + "," + size,
    "--screenshot=" + output, "file://" + source,
  ], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(name + " üretilemedi.");
}

copyFileSync(root + "public/icons/notebook-icon-512.png", root + "public/icons/notebook-icon-maskable-512.png");
console.log("Defter PWA ikonları üretildi: 180, 192, 512 ve maskable 512.");
