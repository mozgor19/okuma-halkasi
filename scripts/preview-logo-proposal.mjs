import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

// Proposal output is isolated from shipped brand assets and the application.
const directory = resolve("outputs/brand-proposals/koru-c-v1");
const paths = [
  "M32 4C25 10 23 17 26 23C27.5 26 30 28 32 31C34 28 36.5 26 38 23C41 17 39 10 32 4Z",
  "M7 15C18 19 27 22 29 36C17 33 8 29 7 15Z",
  "M57 15C46 19 37 22 35 36C47 33 56 29 57 15Z",
  "M6 35C18 38 27 43 30 59C23 51 14 48 6 49Z",
  "M58 35C46 38 37 43 34 59C41 51 50 48 58 49Z",
];
const symbol = paths.map((d) => `<path d="${d}"/>`).join("");
const svg = (size, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" ${extra}>${symbol}</svg>`;
const font = (name) => readFileSync(`public/fonts/${name}.woff2`).toString("base64");
const sizes = [24, 32, 48, 64];
const pane = (dark) => `<section class="pane${dark ? " dark" : ""}" aria-labelledby="${dark ? "dark" : "light"}-title">
  <h2 id="${dark ? "dark" : "light"}-title">${dark ? "Koyu zemin" : "Açık zemin"}</h2>
  <div class="signature">${svg(84)}<span>Koru</span></div>
  <div class="rule"></div>
  <h3>Tek renk işaret</h3>
  <div class="samples">${sizes.map((size) => `<figure><div class="sample">${svg(size, `data-size="${size}" data-mark="${dark ? "dark" : "light"}-${size}"`)}</div><figcaption>${size} px</figcaption></figure>`).join("")}</div>
  <h3>Uygulama simgesi</h3>
  <div class="samples">${sizes.map((size) => `<figure><div class="sample"><div class="app-icon" style="width:${size}px;height:${size}px">${svg(Math.round(size * 0.7))}</div></div><figcaption>${size} px</figcaption></figure>`).join("")}</div>
  <div class="nav-example"><div class="nav-brand">${svg(24)}<strong>Koru</strong></div><span>Okuma gruplarım</span></div>
</section>`;

const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Koru | C logo taslağı</title>
<style>
@font-face{font-family:Bricolage;font-weight:600 700;src:url(data:font/woff2;base64,${font("bricolage-latin")}) format("woff2")}
@font-face{font-family:Bricolage;font-weight:600 700;src:url(data:font/woff2;base64,${font("bricolage-latin-ext")}) format("woff2");unicode-range:U+0100-024F}
*{box-sizing:border-box;letter-spacing:0}html{background:#fff;color:#172d45;font-family:Bricolage,system-ui,sans-serif;font-size:16px}
body{margin:0}main{max-width:1160px;margin:0 auto;padding:40px 32px}
header{display:flex;justify-content:space-between;align-items:start;gap:24px;padding-bottom:24px}
h1{font-size:26px;line-height:1.25;margin:0 0 8px;font-weight:700}header p{color:#526477;margin:0;line-height:1.5}
.status{font-size:13px;line-height:1.5;padding:8px 0;text-align:right;color:#526477;max-width:180px}
.panes{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #c8cdd1;border-bottom:1px solid #c8cdd1}
.pane{--paper:#fffdf7;--ink:#172d45;--muted:#526477;--line:#c8cdd1;background:var(--paper);color:var(--ink);padding:28px 32px;min-width:0}
.pane.dark{--paper:#15130f;--ink:#fffdf7;--muted:#c5c0b7;--line:#56524b}
h2{font-size:14px;font-weight:600;margin:0;color:var(--muted)}h3{font-size:14px;margin:24px 0 8px;font-weight:600}
svg{display:block;flex:none}.signature{display:flex;align-items:center;justify-content:center;gap:18px;height:184px}
.signature span{font-size:64px;line-height:1;font-weight:700}.rule{border-top:1px solid var(--line)}
.samples{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}figure{margin:0;text-align:center;min-width:0}
.sample{height:80px;display:flex;align-items:center;justify-content:center}figcaption{font-size:13px;line-height:1.5;color:var(--muted)}
.app-icon{background:#e2c63f;color:#172d45;display:flex;align-items:center;justify-content:center;border-radius:18%;flex:none}
.nav-example{margin-top:32px;border-top:1px solid var(--line);padding-top:20px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.nav-brand{display:flex;align-items:center;gap:8px;flex:none}.nav-brand strong{font-size:22px;line-height:1.3;font-weight:700}
.nav-example>span{font-size:14px;color:var(--muted);overflow-wrap:anywhere}
footer{padding-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:24px;color:#526477;line-height:1.6;font-size:14px}footer p{margin:0}
@media(max-width:620px){main{padding:24px 16px}header{display:block}.status{text-align:left;max-width:none;padding:12px 0 0}.panes{grid-template-columns:1fr}.pane{padding:24px 20px}.signature{height:164px;gap:14px}.signature svg{width:70px;height:70px}.signature span{font-size:56px}.samples{gap:8px}footer{grid-template-columns:1fr;gap:12px}h1{font-size:24px}}
</style></head><body><main>
<header><div><h1>C / Sayfa ve yaprak</h1><p>Koru · Logo geliştirme önerisi · 19 Ekim 2026</p></div><div class="status">Onay bekliyor<br>Uygulamaya uygulanmadı</div></header>
<div class="panes">${pane(false)}${pane(true)}</div>
<footer><p>Kitabın iki sayfası, yukarıda yapraklara dönüşüyor. Ortadaki boşluk kitap sırtını ve ağacın gövdesini birlikte taşıyor.</p><p>Mevcut Bricolage Grotesque, mürekkep ve sarı korundu. Bu bağımsız bir taslaktır; mevcut logo ve dört görünüm değiştirilmedi.</p></footer>
</main></body></html>`;

mkdirSync(directory, { recursive: true });
const htmlPath = resolve(directory, "preview.html");
const svgPath = resolve(directory, "koru-c-proposal.svg");
writeFileSync(htmlPath, html);
writeFileSync(svgPath, svg(64).replace('aria-hidden="true"', 'role="img" aria-labelledby="title"').replace(symbol, `<title id="title">Koru C logo taslağı: sayfa ve yaprak</title>${symbol}`));
writeFileSync(resolve(directory, "report.json"), JSON.stringify({ status: "running", scope: "preview-only", checkedAt: new Date().toISOString(), approvedForIntegration: false }));
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const checks = [];
try {
  for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 960 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { assert.ok(["file:", "data:"].includes(new URL(request.url()).protocol), "Preview cannot request the network"); });
    await page.goto(pathToFileURL(htmlPath).href);
    await page.evaluate(() => document.fonts.ready);
    const state = await page.evaluate(() => ({
      fontsReady: document.fonts.check("700 56px Bricolage", "Koru İıĞğŞşÇçÖöÜü"),
      overflow: document.documentElement.scrollWidth > innerWidth,
      marks: [...document.querySelectorAll("[data-size]")].map((mark) => ({ expected: Number(mark.dataset.size), width: mark.getBoundingClientRect().width, height: mark.getBoundingClientRect().height })),
    }));
    assert.equal(state.fontsReady, true);
    assert.equal(state.overflow, false);
    assert.equal(errors.length, 0);
    for (const mark of state.marks) assert.ok(mark.width === mark.expected && mark.height === mark.expected, "Small symbol sizes must be real CSS pixels");
    await page.screenshot({ path: resolve(directory, `preview-${width}.png`), fullPage: true });
    for (const mode of ["light", "dark"]) {
      const png = await page.locator(`[data-mark="${mode}-24"]`).screenshot();
      const ink = await page.evaluate(async ({ base64, dark }) => {
        const image = new Image();
        image.src = "data:image/png;base64," + base64;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 24;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, 24, 24).data;
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const light = pixels[i] + pixels[i + 1] + pixels[i + 2];
          if ((!dark && light < 240) || (dark && light > 650)) count++;
        }
        return count;
      }, { base64: png.toString("base64"), dark: mode === "dark" });
      assert.ok(ink > 60 && ink < 450, "24px symbol must have visible ink and negative space");
      checks.push({ width, mode, size: 24, inkPixels: ink });
    }
    await page.close();
  }
} finally { await browser.close(); }
const report = { status: "passed", scope: "preview-only-not-production-brand-acceptance", checkedAt: new Date().toISOString(), approvedForIntegration: false, sourceDigest: createHash("sha256").update(paths.join("\n")).update(html).digest("hex"), checks,
  limitations: "Raster concept C was redrawn as a vector for operator review. Checks cover local font loading, bounds, real CSS sizes and nonblank pixels, not trademark clearance or complete four-theme application acceptance." };
writeFileSync(resolve(directory, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, scope: report.scope, html: htmlPath, svg: svgPath, checks: checks.length, productionBrandChanged: false }, null, 2));
