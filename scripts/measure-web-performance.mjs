import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { readGroupsDevelopmentSettings } from "./groups-development.mjs";
import { loopbackOrigin, testOrigin, testRunId, testOutputPath } from "./test-environment.mjs";

const args = process.argv.slice(2);
if (args.some((arg) => !/^--origin=.+$/.test(arg))) throw new Error("Only --origin is supported.");
const origin = loopbackOrigin(args.find((arg) => arg.startsWith("--origin="))?.slice(9) || testOrigin);
if (!testRunId) throw new Error("Performance measurement requires named, isolated local fixtures.");
const output = testOutputPath("web-performance");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const samples = [];
try {
  for (const account of ["anonymous", "authenticated"]) for (let run = 0; run < 3; run++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: "block" });
    try {
      if (account === "authenticated") {
        const config = await (await context.request.get(origin + "/api/onboarding/config")).json();
        assert.equal(config.local, true); assert.equal(config.enabled, true);
        const response = await context.request.post(origin + "/api/auth/login", { headers: { Origin: origin }, data: { username: "demo.single", password: readGroupsDevelopmentSettings().password } });
        assert.equal(response.status(), 200);
      }
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.addInitScript(() => {
        window.__koruLab = { lcpMs: 0, cls: 0 };
        new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__koruLab.lcpMs = entry.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__koruLab.cls += entry.value; }).observe({ type: "layout-shift", buffered: true });
      });
      for (const temperature of ["cold", "warm"]) {
        await page.goto(origin + (account === "anonymous" ? "/login" : "/"), { waitUntil: "domcontentloaded" });
        assert.equal(await page.locator('script[src*="/@vite/client"]').count(), 0, "Do not report development-server timings as production measurements");
        if (account === "authenticated") await page.waitForFunction(() => {
          const picker = document.querySelector(".person-picker");
          return picker?.querySelector("strong")?.textContent?.includes("Demo") && Object.keys(picker).some((key) => key.startsWith("__reactProps"));
        });
        else await page.waitForFunction(() => Object.keys(document.getElementById("username") || {}).some((key) => key.startsWith("__reactProps")));
        const readyMs = await page.evaluate(() => performance.now());
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1500);
        const metrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType("navigation")[0];
          const resources = performance.getEntriesByType("resource");
          return { ...window.__koruLab, domContentLoadedMs: navigation.domContentLoadedEventEnd,
            transferBytes: resources.reduce((sum, entry) => sum + entry.transferSize, navigation.transferSize),
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
        });
        samples.push({ account, temperature, run: run + 1, readyMs: Math.round(readyMs), ...metrics });
        if (run === 0) await page.screenshot({ path: `${output}/${account}-${temperature}.png`, animations: "disabled" });
      }
    } finally { await context.close(); }
  }
  const summary = [];
  for (const account of ["anonymous", "authenticated"]) for (const temperature of ["cold", "warm"]) {
    const selected = samples.filter((sample) => sample.account === account && sample.temperature === temperature);
    const median = (field) => selected.map((sample) => sample[field]).sort((a, b) => a - b)[1];
    summary.push({ account, temperature, medianLcpMs: Math.round(median("lcpMs")), medianReadyMs: median("readyMs"), worstCls: Math.max(...selected.map((sample) => sample.cls)) });
  }
  writeFileSync(`${output}/report.json`, JSON.stringify({ checkedAt: new Date().toISOString(), environment: "Local production bundle, Chromium mobile, 1.6Mbps/150ms, CPU x4, service worker disabled; NOT real-device or Internet-backend timings", samples, summary }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally { await browser.close(); }
