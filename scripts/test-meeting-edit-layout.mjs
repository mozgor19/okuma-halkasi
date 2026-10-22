import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, devices, webkit } from "playwright";
import { readGroupsDevelopmentSettings } from "./groups-development.mjs";
import { sourceIdentity } from "./release-source.mjs";
import { testOrigin as origin, testOutputPath, testRunId } from "./test-environment.mjs";

assert.ok(testRunId, "An isolated fixture is required");
const engine = process.argv.includes("--webkit") ? "webkit" : "chromium";
const output = testOutputPath("meeting-edit-layout-" + engine);
mkdirSync(output, { recursive: true });
const browser = await (engine === "webkit" ? webkit : chromium).launch({
  ...(engine === "webkit" && process.env.KORU_WEBKIT_EXECUTABLE ? { executablePath: process.env.KORU_WEBKIT_EXECUTABLE } : {}),
  ...(engine === "chromium" ? { args: ["--no-sandbox"] } : {}),
});
const context = await browser.newContext({ ...devices["iPhone 13"], locale: "tr-TR" });
const page = await context.newPage();
page.setDefaultTimeout(15_000);
const headers = { Origin: origin, "X-Reading-Group": "default" };
const errors = [], layouts = [];
page.on("pageerror", error => errors.push(error.message));
let previous, before, status = "failed", failure;
try {
  await page.goto(origin + "/login");
  assert.equal(await page.locator('script[src*="/@vite/client"]').count(), 0);
  assert.ok(await page.locator('script[src^="/_next/static/"]').count(), "Test the minified production bundle");
  const { password } = readGroupsDevelopmentSettings();
  assert.equal((await context.request.post(origin + "/api/auth/login", { headers, data: { username: "demo.multi", password } })).status(), 200);
  assert.equal((await context.request.post(origin + "/api/groups", { headers, data: { groupId: "default" } })).status(), 200);
  previous = (await (await context.request.get(origin + "/api/groups")).json()).groups.find(group => group.id === "default");
  before = await (await context.request.get(origin + "/api/state", { headers })).json();
  const schemes = engine === "webkit" ? ["editorial", "catalogue", "notebook", "minimal"] : ["notebook"];
  for (const width of [320, 390, 1440]) for (const scheme of (width === 1440 ? ["notebook"] : schemes)) for (const mode of ["light", "dark"]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    assert.equal((await context.request.patch(origin + "/api/groups/appearance", { headers, data: { scheme, mode } })).status(), 200);
    await page.goto(origin + "/?meeting=1&group=default");
    await page.waitForFunction(() => Object.keys(document.querySelector(".person-picker") || {}).some(key => key.startsWith("__reactProps")));
    await page.getByRole("button", { name: "Buluşmayı düzenle", exact: true }).click();
    const dialog = page.locator(".meeting-edit-dialog"), form = dialog.locator("form");
    await dialog.waitFor();
    await page.evaluate(() => document.fonts.ready);
    await dialog.locator('input[type="datetime-local"]').fill("2026-10-23T19:30");
    await dialog.locator('input[name="location"]').fill("Uzun bulusma yeri ".repeat(10).slice(0, 180));
    await dialog.locator('input[name="mapUrl"]').fill("https://maps.google.com/?q=" + "x".repeat(1500));
    await dialog.locator('input[maxlength="180"]').last().fill("UzunOkunanBolum".repeat(12).slice(0, 180));
    await dialog.locator("textarea").fill("UzunNot".repeat(140));
    const measure = () => dialog.evaluate(element => {
      const form = element.querySelector("form"), box = form.getBoundingClientRect();
      const fields = [...form.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]),textarea,select')].map(field => {
        const r = field.getBoundingClientRect();
        return { type: field.type, left: r.left, right: r.right, width: r.width, font: parseFloat(getComputedStyle(field).fontSize) };
      });
      const r = element.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, translate: getComputedStyle(element).translate,
        formWidth: box.width, scrollWidth: form.scrollWidth, clientWidth: form.clientWidth, scrollLeft: form.scrollLeft,
        documentWidth: document.documentElement.scrollWidth, fields };
    });
    const check = async () => {
      const geometry = await measure();
      assert.ok(geometry.left >= -1 && geometry.right <= width + 1);
      assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1 && geometry.documentWidth <= width + 1, "No horizontal form/page overflow");
      assert.ok(Math.abs(geometry.scrollLeft) <= 1, "Focus must not pan the form sideways");
      assert.ok(geometry.fields.every(field => Math.abs(field.width - geometry.formWidth) <= 1), "All entry fields must have equal widths");
      if (width < 681) {
        assert.equal(geometry.translate, "none", "Production CSS must preserve the previous mobile positioning fix");
        assert.ok(geometry.fields.every(field => field.font >= 16));
      }
      return geometry;
    };
    await check();
    await dialog.locator(".venue-choice label").filter({ hasText: "Çevrim içi" }).click();
    await dialog.locator('input[name="onlineUrl"]').fill("https://meet.example.com/" + "x".repeat(1500));
    await dialog.locator("textarea").focus();
    await form.evaluate(element => { element.scrollLeft = 200; });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    // Hidden horizontal overflow must not be programmatically scrollable by focus either.
    await check();
    await dialog.locator(".venue-choice label").filter({ hasText: "Yüz yüze" }).click();
    assert.equal(await dialog.locator('input[name="location"]').inputValue(), "Uzun bulusma yeri ".repeat(10).slice(0, 180));
    assert.equal(await form.evaluate(element => element.checkValidity()), true);
    const save = dialog.getByRole("button", { name: "Kaydet", exact: true });
    await save.scrollIntoViewIfNeeded();
    const button = await save.boundingBox();
    assert.ok(button.y >= 0 && button.y + button.height <= (width === 1440 ? 1000 : 844) + 1);
    layouts.push({ width, scheme, mode, ...(await check()) });
    if (width === 390 && scheme === "notebook") await page.screenshot({ path: `${output}/${mode}.png` });
    await dialog.locator('[data-slot="dialog-close"]').click();
    await dialog.waitFor({ state: "hidden" });
  }
  const after = await (await context.request.get(origin + "/api/state", { headers })).json();
  for (const key of ["books", "meetings", "roadmap"]) assert.deepEqual(after[key], before[key], "Cancelled edits must preserve " + key);
  assert.deepEqual(errors, []);
  status = "passed";
} catch (error) {
  failure = error.message;
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  throw error;
} finally {
  if (previous) await context.request.patch(origin + "/api/groups/appearance", { headers, data: { scheme: previous.scheme, mode: previous.mode } });
  writeFileSync(`${output}/${status === "passed" ? "report" : "failed-" + Date.now()}.json`, JSON.stringify({ ...sourceIdentity(), status, engine, productionBundle: true,
    checkedAt: new Date().toISOString(), layouts, errors, failure, limitation: "Mobile browser emulation, not physical phone keyboard acceptance; no domain records saved." }, null, 2));
  await context.close(); await browser.close();
  console.log(JSON.stringify({ status, engine, layouts: layouts.length, failure }));
}
