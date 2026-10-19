import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const fonts = [
  ["bricolage-latin", "bricolagegrotesque/v9/3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGIInE"],
  ["bricolage-latin-ext", "bricolagegrotesque/v9/3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGGInHEVA"],
  ["literata-latin", "literata/v40/or3PQ6P12-iJxAIgLa78DkTtAoDhk0oVpaK3YLanFLHpPf2TbLi4J_HWTA"],
  ["literata-latin-ext", "literata/v40/or3PQ6P12-iJxAIgLa78DkTtAoDhk0oVpaK3YLanFLHpPf2TbLi4J__WTFCW"],
  ["literata-italic-latin", "literata/v40/or3yQ6P12-iJxAIgLYT1PLs1a-t7PU0AbeE9KK5U5Ck"],
  ["literata-italic-latin-ext", "literata/v40/or3yQ6P12-iJxAIgLYT1PLs1a-t7PU0AbeE9KK5a5ClqOw"],
];
mkdirSync("public/fonts", { recursive: true });
mkdirSync("public/brand", { recursive: true });
if (process.argv.includes("--download-fonts")) {
  for (const [name, resource] of fonts) {
    const response = await fetch(`https://fonts.gstatic.com/s/${resource}.woff2`);
    if (!response.ok) throw new Error("Official font download failed: " + name);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.toString("ascii", 0, 4) !== "wOF2") throw new Error("Invalid font: " + name);
    writeFileSync(`public/fonts/${name}.woff2`, bytes);
  }
  for (const family of ["bricolagegrotesque", "literata"]) {
    const response = await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`);
    if (!response.ok) throw new Error("Official font license download failed");
    const license = await response.text();
    if (!license.includes("SIL OPEN FONT LICENSE")) throw new Error("Invalid font license");
    writeFileSync(`public/fonts/${family}-OFL.txt`, license);
  }
}
const server = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const path = new URL(req.url, "http://localhost").pathname;
  const font = fonts.find(([name]) => path === `/fonts/${name}.woff2`);
  if (font) { res.setHeader("Content-Type", "font/woff2"); res.end(readFileSync(`public${path}`)); }
  else if (path === "/icon.svg") { res.setHeader("Content-Type", "image/svg+xml"); res.end(readFileSync("public/brand/koru-icon.svg")); }
  else { res.writeHead(404); res.end(); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const icon = readFileSync("public/brand/koru-icon.svg", "utf8");
  for (const [name, size, svg] of [
    ["koru-apple-180", 180, icon.replace('rx="72"', 'rx="0"')], ["koru-192", 192, icon], ["koru-512", 512, icon],
    ["koru-maskable-512", 512, icon.replace('rx="72"', 'rx="0"')],
    ["koru-badge-96", 96, readFileSync("public/brand/koru-mark.svg", "utf8").replace('<svg ', '<svg style="color:white" ')],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{width:100%;height:100%;display:block}</style>${svg}`);
    await page.screenshot({ path: `public/brand/${name}.png`, omitBackground: true });
  }
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<!doctype html><html lang="tr"><style>
    @font-face{font-family:Bricolage;font-weight:600 700;src:url(${origin}/fonts/bricolage-latin.woff2)}
    @font-face{font-family:Bricolage;font-weight:600 700;src:url(${origin}/fonts/bricolage-latin-ext.woff2);unicode-range:U+0100-024F}
    *{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;background:#fffdf7;color:#172d45;font-family:Bricolage,system-ui,sans-serif;font-weight:600;letter-spacing:0}
    main{height:630px;position:relative;padding:64px 72px;border-top:12px solid #172d45;border-bottom:12px solid #e2c63f;overflow:hidden}
    header{display:flex;align-items:center;gap:20px;font-size:64px;font-weight:700}header img{width:72px;height:72px;border-radius:8px}
    h1{font-size:76px;line-height:1.12;font-weight:600;margin:48px 0 24px;max-width:900px}p{font-size:25px;line-height:1.45;margin:0;color:#1f5874}
    .rule{position:absolute;right:72px;top:64px;width:100px;height:160px;border-left:8px solid #ec543f;border-right:8px solid #172d45}.rule:after{content:"";display:block;width:8px;height:112px;margin-left:38px;background:#e2c63f}
  </style><main><header><img src="${origin}/icon.svg" alt="">Koru</header><div class="rule"></div><h1>Birlikte oku,<br>düşün, paylaş.</h1><p>Kitaplar, buluşmalar ve okuma grubun.</p></main></html>`);
  await page.evaluate(() => document.fonts.ready);
  if (!(await page.evaluate(() => document.fonts.check('600 76px Bricolage', 'düşün')))) throw new Error("Brand font failed to load");
  await page.screenshot({ path: "public/brand/koru-share-v1.png" });
  console.log("Generated Koru icons and 1200x630 social image. Legacy assets preserved.");
} finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
