import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { checkAccountInstall } from "./account-install-checks.mjs";
import { readGroupsDevelopmentSettings } from "./groups-development.mjs";
import { testRunId, testOrigin, testOutputPath } from "./test-environment.mjs";
import { sourceIdentity } from "./release-source.mjs";

if (!testRunId) throw Error("An isolated fixture is required");
const engine = process.argv.includes("--webkit") ? "webkit" : "chromium";
const browser = await (engine === "webkit" ? webkit : chromium).launch({
  ...(engine === "webkit" && process.env.KORU_WEBKIT_EXECUTABLE ? { executablePath: process.env.KORU_WEBKIT_EXECUTABLE } : {}),
  ...(engine === "chromium" ? { args: ["--no-sandbox"] } : {}),
});
const output = testOutputPath("account-install-" + engine);
mkdirSync(output, { recursive: true });
let status = "failed", checks = [], failure;
try {
  const html = await (await fetch(testOrigin + "/login", { signal: AbortSignal.timeout(15_000) })).text();
  assert.doesNotMatch(html, /\/@vite\/client/);
  assert.match(html, /\/_next\/static\//);
  checks = await checkAccountInstall(browser, testOrigin, readGroupsDevelopmentSettings().password, (page, name) => page.screenshot({ path: `${output}/${name}.png`, animations: "disabled" }));
  status = "passed";
} catch (error) { failure = error.message; checks = error.checks || checks; throw error; }
finally {
  await browser.close();
  writeFileSync(`${output}/${status === "passed" ? "report" : "failed-" + Date.now()}.json`, JSON.stringify({ ...sourceIdentity(), status, engine, productionBundle: true, checkedAt: new Date().toISOString(), checks, failure,
    limitation: "Synthetic browser install events and emulated iOS are not physical installation acceptance. No real accounts or mail created; account-status responses mocked." }, null, 2));
  console.log(JSON.stringify({ status, engine, checks: checks.length, failure }));
}
