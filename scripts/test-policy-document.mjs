import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { sourceIdentity } from "./release-source.mjs";
import { testOrigin, testOutputPath, testRunId } from "./test-environment.mjs";

if (!testRunId) throw Error("Isolated local fixture required");
const engine = process.argv.includes("--webkit") ? "webkit" : "chromium";
const output = testOutputPath("policy-document-" + engine); mkdirSync(output, { recursive: true });
const browser = await (engine === "webkit" ? webkit : chromium).launch({ ...(engine === "webkit" && process.env.KORU_WEBKIT_EXECUTABLE ? { executablePath: process.env.KORU_WEBKIT_EXECUTABLE } : {}), ...(engine === "chromium" ? { args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const page = await context.newPage(), errors = [], checks = [];
page.setDefaultTimeout(20000); page.on("pageerror", error => errors.push(error.message));
let restrictedTest = false, releaseConfig, status = "failed", failure;
let configGate = new Promise(resolve => { releaseConfig = resolve; });
await page.route("**/api/onboarding/config", async route => {
  await configGate;
  await route.fulfill({ json: { brand: "Koru Policy Test", enabled: true, ready: true, local: false, restrictedTest } });
});
try {
  for (const [path, title] of [["/privacy", "Gizlilik ve kişisel veriler"], ["/terms", "Kullanım koşulları"]]) {
    restrictedTest = false; configGate = new Promise(resolve => { releaseConfig = resolve; });
    const response = await page.goto(testOrigin + path);
    assert.equal(response.status(), 200);
    assert.ok(!(await response.text()).includes("Bu metin sınırlı deneme sürümü içindir."));
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    assert.equal(await page.locator(".policy-document .onboarding-test-notice").count(), 0);
    releaseConfig();
    await page.locator(".policy-document .login-brand strong").getByText("Koru Policy Test", { exact: true }).waitFor();
    assert.equal(await page.locator(".policy-document .onboarding-test-notice").count(), 0);
    const sections = await page.locator(".policy-document section").allTextContents();
    assert.ok(sections.length >= 6);
    for (const href of ["/privacy", "/terms", "/support"]) assert.ok(await page.locator(`.policy-document footer a[href="${href}"]`).count());
    checks.push(path + ": no trial banner in server render, pending config or hydrated public mode; policy body and links retained");
    restrictedTest = true; await page.reload();
    await page.locator(".policy-document .onboarding-test-notice").getByText("Bu metin sınırlı deneme sürümü içindir.", { exact: false }).waitFor();
    assert.deepEqual(await page.locator(".policy-document section").allTextContents(), sections);
    restrictedTest = false; await page.reload();
    await page.locator(".policy-document .login-brand strong").getByText("Koru Policy Test", { exact: true }).waitFor();
    assert.equal(await page.locator(".policy-document .onboarding-test-notice").count(), 0);
    for (const width of [390, 1440]) for (const dark of [false, true]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), dark);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: `${output}/${path.slice(1)}-${width}-${dark ? "dark" : "light"}.png`, fullPage: true, animations: "disabled" });
    }
    checks.push(path + ": restricted test banner retained, public reload removes it, body unchanged and mobile/desktop light/dark fit");
  }
  assert.deepEqual(errors, []); status = "passed";
} catch (error) { failure = error.message; throw error; }
finally {
  releaseConfig(); await context.close(); await browser.close();
  writeFileSync(`${output}/${status === "passed" ? "report" : "failed-" + Date.now()}.json`, JSON.stringify({ ...sourceIdentity(), status, engine, checkedAt: new Date().toISOString(), checks, errors, failure,
    limitation: "Compiled local wrapper/config behavior only. No real users, policy changes or provider acceptance; not legal/manual release proof." }, null, 2));
  console.log(JSON.stringify({ status, engine, checks: checks.length, failure }));
}
