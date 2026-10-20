import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { infoSite } from "../public-info/site.mjs";
import { assetDigest, infoDirectory } from "./build-public-info.mjs";
import { join } from "node:path";

if (process.argv.length > 2) throw new Error("Only the fixed public-information origin is supported");
const deployment = JSON.parse(readFileSync(join(infoDirectory, "deployment.json"), "utf8"));
assert.equal(deployment.status, "passed");
assert.equal(deployment.origin, infoSite.origin);
assert.equal(deployment.applicationUnchanged, true);
assert.equal(deployment.assetDigest, assetDigest());
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const checks = [], errors = [];
let passed = false;
try {
  for (const [width, mode] of [[390, "dark"], [1440, "light"]]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, colorScheme: mode, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("requestfailed", (request) => errors.push("Failed public asset: " + new URL(request.url()).pathname));
      for (const [path, heading] of [["/", "Koru"], ["/privacy", "Gizlilik ve kişisel veriler"], ["/terms", "Kullanım koşulları"]]) {
        const response = await page.goto(infoSite.origin + path);
        assert.equal(response.status(), 200);
        assert.equal(response.headers()["x-koru-site"], "public-information-v1");
        await page.getByRole("heading", { name: heading, level: 1, exact: true }).waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains("dark")), mode === "dark");
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        if (path === "/") {
          const image = page.locator(".product-example img");
          await image.evaluate((img) => img.decode());
          assert.equal(await image.evaluate((img) => img.naturalWidth), width === 390 ? 390 : 1440);
          assert.equal(await page.evaluate(() => document.fonts.check('600 24px "Bricolage Grotesque"') && document.fonts.check('400 16px Literata')), true);
        }
        await page.screenshot({ path: `outputs/koru-public-info/https-${width}-${mode}-${path === "/" ? "home" : path.slice(1)}.png`, fullPage: true });
        checks.push(`HTTPS ${width}px ${mode} ${path}`);
      }
      assert.equal((await context.cookies()).length, 0);
    } finally { await context.close(); }
  }
  assert.deepEqual(errors, []);
  passed = true;
} finally {
  await browser.close();
  const report = { status: passed ? "passed" : "failed", checkedAt: new Date().toISOString(), origin: infoSite.origin, assetDigest: deployment.assetDigest, checks, errors, scope: "Public information only; not app, account, OAuth verification or physical-device acceptance" };
  writeFileSync("outputs/koru-public-info/https-report.json", JSON.stringify(report, null, 2));
  console.log(`Public HTTPS information: ${report.status}, ${checks.length} checks`);
}
