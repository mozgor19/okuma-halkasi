import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { testOutputPath } from "./test-environment.mjs";

const source = readFileSync("public/koru-sw.js", "utf8");
const output = testOutputPath("web-updates");
mkdirSync(output, { recursive: true });
let version = "a";
const checks = [];
const server = createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.url === "/koru-sw.js") {
    response.setHeader("Content-Type", "text/javascript");
    assert.match(source, /const SHELL_CACHE = "koru-public-shell-v\d+";/);
    response.end(source.replace(/const SHELL_CACHE = "koru-public-shell-v\d+";/, `const SHELL_CACHE = "koru-public-shell-test-${version}";`));
  } else if (request.url === "/offline.html") {
    if (version === "broken") { response.writeHead(503); response.end("Unavailable"); return; }
    response.setHeader("Content-Type", "text/html");
    response.end(`<h1>Offline ${version}</h1>`);
  } else {
    response.setHeader("Content-Type", "text/html");
    response.end('<label>Not<textarea id="draft"></textarea></label>');
  }
});
let browser;
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({ serviceWorkers: "allow" });
  await context.addCookies([{ name: "update_fixture", value: "retained", url: origin, httpOnly: true }]);
  const first = await context.newPage();
  await first.goto(origin);
  await first.evaluate(async () => {
    await navigator.serviceWorker.register("/koru-sw.js", { scope: "/", updateViaCache: "none" });
    await navigator.serviceWorker.ready;
  });
  await first.waitForFunction(() => !!navigator.serviceWorker.controller);
  await first.evaluate(async () => { window.originalWorker = (await navigator.serviceWorker.getRegistration()).active; });
  await first.locator("textarea").fill("İlk pencerenin kaydedilmemiş notu");
  const second = await context.newPage();
  await second.goto(origin);
  await second.locator("textarea").fill("İkinci pencerenin kaydedilmemiş notu");
  version = "b";
  await first.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await first.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
  assert.equal(await first.evaluate(() => navigator.serviceWorker.controller === window.originalWorker), true);
  assert.equal(await first.locator("textarea").inputValue(), "İlk pencerenin kaydedilmemiş notu");
  assert.equal(await second.locator("textarea").inputValue(), "İkinci pencerenin kaydedilmemiş notu");
  checks.push("New worker waits without reloading either unsaved form");
  await first.close();
  assert.equal(await second.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting), true);
  checks.push("Closing one of two windows does not force activation");
  await second.close();
  await assert.doesNotReject(async () => {
    for (let i = 0; i < 100; i++) {
      const worker = context.serviceWorkers().filter((item) => item.url() === origin + "/koru-sw.js").at(-1);
      try {
        if (worker && JSON.stringify(await worker.evaluate(() => caches.keys())) === '["koru-public-shell-test-b"]') return;
      } catch { /* The old worker can exit while the replacement activates. */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("New worker did not activate after all windows closed");
  });
  const reopened = await context.newPage();
  await reopened.goto(origin);
  await reopened.waitForFunction(() => !!navigator.serviceWorker.controller);
  assert.equal((await context.cookies()).find((cookie) => cookie.name === "update_fixture")?.value, "retained");
  await context.setOffline(true);
  await reopened.goto(origin + "/reopened");
  assert.equal(await reopened.locator("h1").textContent(), "Offline b");
  await context.setOffline(false);
  checks.push("Reopened app uses the new offline shell, cleans the old cache and retains its session cookie");
  version = "broken";
  await reopened.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
  await reopened.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration()).installing);
  assert.equal(await reopened.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting), false);
  assert.deepEqual(await reopened.evaluate(() => caches.keys()), ["koru-public-shell-test-b"]);
  checks.push("Failed shell download cannot replace the working worker");
  console.log(`PWA update lifecycle: ${checks.length} checks passed`);
  writeFileSync(`${output}/report.json`, JSON.stringify({ status: "passed", checkedAt: new Date().toISOString(), scope: "Chromium controlled loopback, not physical installed-device acceptance", checks }, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
