import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { readGroupsDevelopmentSettings } from "./groups-development.mjs";
import { sourceIdentity } from "./release-source.mjs";
import { testRunId, testOrigin, testOutputPath } from "./test-environment.mjs";

if (!testRunId) throw Error("An isolated local fixture is required");
const engine = process.argv.includes("--webkit") ? "webkit" : "chromium";
const output = testOutputPath("email-verification-" + engine);
mkdirSync(output, { recursive: true });
const browser = await (engine === "webkit" ? webkit : chromium).launch({
  ...(engine === "webkit" && process.env.KORU_WEBKIT_EXECUTABLE ? { executablePath: process.env.KORU_WEBKIT_EXECUTABLE } : {}),
  ...(engine === "chromium" ? { args: ["--no-sandbox"] } : {}),
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
const page = await context.newPage(), checks = [], errors = [];
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(15_000);
let status = "failed", failure;
try {
  const response = await context.request.post(testOrigin + "/api/auth/login", { headers: { Origin: testOrigin },
    data: { username: "demo.multi", password: readGroupsDevelopmentSettings().password } });
  assert.equal(response.status(), 200);
  const config = await (await context.request.get(testOrigin + "/api/onboarding/config")).json();
  let pending = false, verified = false, canComplete = false, loginCalls = 0;
  await page.route("**/api/onboarding/config", route => route.fulfill({ json: { ...config, identityProvider: "firebase" } }));
  await page.route("**/api/onboarding/account", route => route.fulfill({ json: {
    username: "demo.multi", name: "Synthetic Reader", email: verified ? "reader@example.test" : null,
    verified, verificationPending: pending,
  } }));
  await page.route("**/api/onboarding/link-email", route => {
    pending = true;
    return route.fulfill({ json: { ok: true, message: "Sentetik doğrulama postası hazır." } });
  });
  await page.route("**/api/auth/login", route => {
    const body = route.request().postDataJSON();
    assert.equal(body.username, "demo.multi"); assert.equal(body.completeVerification, true);
    assert.equal(body.password, "Synthetic-Completion-Password-9724");
    loginCalls++;
    if (canComplete) { verified = true; pending = false; }
    return route.fulfill({ status: canComplete ? 200 : 401, json: canComplete ? { ok: true } : { error: "Synthetic unverified" } });
  });
  const visit = async () => {
    await page.waitForLoadState("networkidle");
    await page.goto(testOrigin + "/account");
    await page.getByRole("heading", { name: "Hesabım", exact: true }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some(el => Object.keys(el).some(key => key.startsWith("__reactProps"))));
  };
  await visit();
  await page.locator("#email").fill("reader@example.test");
  await page.locator("#password").fill("Old-Synthetic-Password-8923");
  await page.locator("#newPassword").fill("Synthetic-Completion-Password-9724");
  await page.locator("#confirmPassword").fill("Synthetic-Completion-Password-9724");
  await page.locator("input[name=acceptedPolicy]").check();
  await page.getByRole("button", { name: "Doğrulama bağlantısı gönder", exact: true }).click();
  const finish = page.getByRole("button", { name: "Doğruladım, hesabımı güncelle", exact: true });
  await finish.waitFor();
  assert.equal(await page.locator("#password").count(), 0);
  checks.push("Sending a legacy linking request refreshes status and exposes the completion step, not a misleading group continuation");
  await visit(); await finish.waitFor();
  checks.push("Pending completion remains available after returning from the hosted Firebase handler or reloading");
  await page.getByRole("button", { name: "Doğrulama postasını yeniden iste", exact: true }).click();
  await page.locator("#email").waitFor();
  await visit(); await finish.waitFor();
  checks.push("Resend is available without persisting passwords in the browser");
  for (const width of [320, 1440]) for (const scheme of ["notebook", "editorial", "catalogue", "minimal"]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(({ scheme, dark }) => {
      document.documentElement.dataset.scheme = scheme;
      document.documentElement.classList.toggle("dark", dark);
    }, { scheme, dark });
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll("body *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(el => ({ tag: el.tagName, className: el.className })) }));
    await page.screenshot({ path: `${output}/${width}-${scheme}-${dark ? "dark" : "light"}.png`, animations: "disabled" });
    assert.ok(layout.scrollWidth <= layout.width, JSON.stringify({ scheme, dark, ...layout }));
    const rect = await finish.boundingBox(); assert.ok(rect.x >= 0 && rect.x + rect.width <= width && rect.height >= 44);
  }
  checks.push("Completion controls fit all four light/dark schemes at320/1440 without changing palettes");
  await page.locator("#verificationPassword").fill("Synthetic-Completion-Password-9724");
  await finish.click();
  await page.getByRole("alert").filter({ hasText: "Önce e-postadaki bağlantıyı doğrula" }).waitFor();
  assert.equal(loginCalls, 1); assert.equal(verified, false);
  checks.push("Unverified/wrong-password sign-in remains on the form with an actionable error and no success claim");
  canComplete = true;
  await finish.click();
  await page.getByText("E-posta adresin doğrulanmış.", { exact: true }).waitFor();
  assert.equal(loginCalls, 2); assert.equal(await finish.count(), 0);
  await page.waitForLoadState("networkidle");
  assert.deepEqual(errors, []);
  checks.push("Successful strict verification sign-in reloads the canonical account status and clears the pending form");
  status = "passed";
} catch (error) { failure = error.message; throw error; }
finally {
  await context.close(); await browser.close();
  writeFileSync(`${output}/${status === "passed" ? "report" : "failed-" + Date.now()}.json`, JSON.stringify({ ...sourceIdentity(), status, engine,
    checkedAt: new Date().toISOString(), checks, failure,
    limitation: "UI provider/status/login responses are synthetic. Backend UID/claim/session invariants are covered separately; no real accounts or mail." }, null, 2));
  console.log(JSON.stringify({ status, engine, checks: checks.length, failure }));
}
