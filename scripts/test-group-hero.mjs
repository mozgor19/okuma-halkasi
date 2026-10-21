import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { readGroupsDevelopmentSettings } from "./groups-development.mjs";
import { testOrigin as origin, testOutputPath, testRunId } from "./test-environment.mjs";
import { checkGroupHero } from "./group-hero-checks.mjs";

if (!testRunId) throw Error("A named isolated synthetic fixture is required.");
const output = testOutputPath("group-hero"), screenshots = [], errors = [];
mkdirSync(output, { recursive: true });
const { password } = readGroupsDevelopmentSettings();
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
context.setDefaultTimeout(20_000);
const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
try {
  assert.equal((await context.request.post(origin + "/api/auth/login", { headers: { Origin: origin }, data: { username: "demo.multi", password } })).status(), 200);
  assert.equal((await context.request.post(origin + "/api/groups", { headers: { Origin: origin, "X-Reading-Group": "default" }, data: { groupId: "default" } })).status(), 200);
  const result = await checkGroupHero(page, context, origin, async name => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const path = `${output}/${name}.png`; await page.screenshot({ path, animations: "disabled", fullPage: true }); screenshots.push(path);
  });
  assert.deepEqual(errors, []);
  writeFileSync(`${output}/report.json`, JSON.stringify({ status: "passed", checkedAt: new Date().toISOString(), ...result, screenshots, errors, limitations: ["Local Chromium/synthetic D1 only; not physical device or production acceptance"] }, null, 2));
  console.log(`Group hero passed: ${result.layouts.length} custom/default layouts, ${result.realFileChoosers} real chooser uploads, actual picture pixels changed.`);
} catch (error) {
  writeFileSync(`${output}/failed-${Date.now()}.json`, JSON.stringify({ status: "failed", checkedAt: new Date().toISOString(), failure: error.message, screenshots, errors }, null, 2));
  throw error;
} finally { await context.close(); await browser.close(); }
