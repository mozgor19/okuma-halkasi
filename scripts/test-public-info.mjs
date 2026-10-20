import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { buildInfoSite, infoConfig, infoDirectory } from "./build-public-info.mjs";

if (process.argv.length > 2) throw new Error("Public-info checks accept no remote origin or credentials");
const build = buildInfoSite();
const output = resolve("outputs/koru-public-info");
mkdirSync(output, { recursive: true });
const origin = "http://127.0.0.1:5286";
const log = openSync(join(infoDirectory, "preview.log"), "w", 0o600);
const child = spawn(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "dev", "--config", infoConfig, "--local", "--ip", "127.0.0.1", "--port", "5286", "--inspector-port", "0"], {
  stdio: ["ignore", log, log], env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", CLOUDFLARE_CF_FETCH_ENABLED: "false" },
});
closeSync(log);
let browser;
const checks = [], errors = [];
let passed = false;
try {
  for (let attempt = 0; ; attempt++) {
    if (child.exitCode !== null || attempt === 80) throw new Error("Public-only local preview did not start; inspect its private log");
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).headers.get("x-koru-site") === "public-information-v1") break; } catch { /* Bounded local startup. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({ reducedMotion: "reduce", serviceWorkers: "block" });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const foreign = [];
  page.on("request", (request) => { if (new URL(request.url()).origin !== origin) foreign.push(request.url()); });
  for (const width of [320, 390, 1440]) for (const mode of ["light", "dark"]) for (const [path, heading] of [["/", "Koru"], ["/privacy", "Gizlilik ve kişisel veriler"], ["/terms", "Kullanım koşulları"]]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.emulateMedia({ colorScheme: mode });
    const response = await page.goto(origin + path);
    assert.equal(response.status(), 200);
    assert.equal(response.headers()["set-cookie"], undefined);
    assert.match(response.headers()["content-security-policy"], /connect-src 'none'/);
    await page.getByRole("heading", { name: heading, exact: true, level: 1 }).waitFor();
    await page.waitForFunction((dark) => document.documentElement.classList.contains("dark") === dark, mode === "dark");
    await page.evaluate(() => document.fonts.ready);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.equal(await page.locator("form").count(), 0);
    if (path === "/") {
      const picture = page.locator(".product-example img");
      await picture.evaluate((img) => img.decode());
      assert.deepEqual(await picture.evaluate((img) => [img.naturalWidth, img.naturalHeight]), width <= 680 ? [390, 844] : [1440, 1000]);
    }
    await page.screenshot({ path: `${output}/${width}-${mode}-${path === "/" ? "home" : path.slice(1)}.png`, fullPage: true });
    checks.push(`${width}px ${mode} ${path}`);
  }
  assert.deepEqual(foreign, []);
  assert.equal((await context.cookies()).length, 0);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  checks.push("No foreign requests, application cookies or browser storage");
  for (const path of ["/", "/privacy", "/terms"]) assert.equal((await context.request.get(origin + path, { maxRedirects: 0 })).status(), 200);
  for (const path of ["/api/state", "/login", "/register", "/missing-page"]) assert.equal((await context.request.get(origin + path)).status(), 404);
  assert.equal((await context.request.post(origin + "/")).status(), 405);
  assert.equal((await context.request.head(origin + "/privacy")).status(), 200);
  checks.push("Anonymous pages work; account APIs, forms and unknown URLs stay closed");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/privacy");
  await page.evaluate(() => { document.body.style.fontSize = "32px"; });
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).fontSize), "32px");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: `${output}/390-dark-enlarged.png`, fullPage: true });
  checks.push("Enlarged mobile reading text remains within the viewport");
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const plain = await noJs.newPage();
  await plain.goto(origin);
  await plain.getByRole("heading", { name: "Koru", exact: true, level: 1 }).waitFor();
  await plain.getByRole("navigation", { name: "Ana gezinme" }).getByRole("link", { name: "Gizlilik", exact: true }).click();
  await plain.getByRole("heading", { name: "Gizlilik ve kişisel veriler", exact: true }).waitFor();
  await noJs.close();
  checks.push("Public crawler and no-JavaScript navigation retain complete policy text");
  assert.deepEqual(errors, []);
  await context.close();
  passed = true;
} finally {
  await browser?.close();
  if (child.exitCode === null) {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    await exited; clearTimeout(timer);
  }
  const report = { status: passed ? "passed" : "failed", scope: "public-information-only", assetDigest: build.assetDigest, checkedAt: new Date().toISOString(), checks, errors };
  writeFileSync(join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(`Public information: ${report.status}, ${checks.length} checks. No application/DB deployment.`);
}
