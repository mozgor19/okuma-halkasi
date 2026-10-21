import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { readGroupsDevelopmentSettings } from "./groups-development.mjs";
import { testRunId, testOrigin as origin, testOutputPath } from "./test-environment.mjs";
import { checkMobileDialogs } from "./mobile-dialog-checks.mjs";
import { sourceIdentity } from "./release-source.mjs";

if (!testRunId || process.argv.slice(2).some(arg => !["--webkit", "--production"].includes(arg))) throw Error("Named isolated fixture and optional --webkit/--production required.");
const engine = process.argv.includes("--webkit") ? "webkit" : "chromium";
const productionBundle = process.argv.includes("--production");
const output = testOutputPath("mobile-dialogs-" + (productionBundle ? "production-" : "") + engine), screenshots = [], errors = [];
mkdirSync(output, { recursive: true });
const browser = await (engine === "webkit" ? webkit : chromium).launch({
  ...(engine === "webkit" && process.env.KORU_WEBKIT_EXECUTABLE ? { executablePath: process.env.KORU_WEBKIT_EXECUTABLE } : {}),
  ...(engine === "chromium" ? { args: ["--no-sandbox"] } : {}),
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const page = await context.newPage(); page.setDefaultTimeout(20_000);
page.on("pageerror", error => errors.push(error.message));
let layouts = [], status = "failed", failure;
try {
  if (productionBundle) {
    await page.goto(origin + "/login");
    assert.equal(await page.locator('script[src*="/@vite/client"]').count(), 0);
    assert.ok(await page.locator('script[src^="/_next/static/"]').count(), "Production mode requires the actual compiled bundle");
  }
  const { password } = readGroupsDevelopmentSettings();
  const headers = { Origin: origin, "X-Reading-Group": "default" };
  assert.equal((await context.request.post(origin + "/api/auth/login", { headers, data: { username: "demo.multi", password } })).status(), 200);
  assert.equal((await context.request.post(origin + "/api/groups", { headers, data: { groupId: "default" } })).status(), 200);
  assert.equal((await context.request.post(origin + "/api/account/experience", { headers, data: { kind: "tour", version: 1, state: "dismissed" } })).status(), 200);
  layouts = await checkMobileDialogs(page, context, origin, async name => {
    const path = `${output}/${name}.png`; await page.screenshot({ path, animations: "disabled" }); screenshots.push(path);
  }, productionBundle ? [390] : undefined);
  assert.deepEqual(errors, []); status = "passed";
} catch (error) {
  failure = error.message;
  await page.screenshot({ path: `${output}/failure.png`, animations: "disabled" }).catch(() => {});
  throw error;
} finally {
  writeFileSync(`${output}/${status === "passed" ? "report" : "failed-" + Date.now()}.json`, JSON.stringify({ ...sourceIdentity(), status, engine, productionBundle, checkedAt: new Date().toISOString(), layouts, screenshots, errors, failure,
    limitation: "Desktop browser engine with mobile emulation and simulated visual viewport; not physical iPhone/Android keyboard acceptance." }, null, 2));
  await context.close(); await browser.close();
  console.log(JSON.stringify({ status, engine, layouts: layouts.length, screenshots: screenshots.length, failure }));
}
