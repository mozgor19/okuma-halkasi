import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { groupsSettingsPath, testOrigin as origin, testOutputPath } from "./test-environment.mjs";

const output = testOutputPath("web-pwa");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport:{ width:390, height:844 }, reducedMotion:"reduce", serviceWorkers:"allow" });
context.setDefaultTimeout(20_000);
context.setDefaultNavigationTimeout(45_000);
const page = await context.newPage();
const errors = [], checks = [], foreignFonts = [], hydrationErrors = [];
let originalAppearance;
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error" && /hydration|hydrated/.test(message.text())) hydrationErrors.push("Hydration mismatch"); });
page.on("request", (request) => { if (request.resourceType() === "font" && new URL(request.url()).origin !== origin) foreignFonts.push(new URL(request.url()).origin); });
function check(label) { checks.push(label); console.log("PWA: " + label); }
try {
  const response = await page.goto(origin + "/login");
  assert.equal(response.status(), 200);
  for (const [key, expected] of [["x-content-type-options","nosniff"],["referrer-policy","no-referrer"],["x-frame-options","DENY"]]) assert.equal(response.headers()[key], expected);
  assert.ok(response.headers()["content-security-policy"].includes("frame-ancestors 'none'"));
  await page.waitForFunction(() => Object.keys(document.getElementById("username") || {}).some((key) => key.startsWith("__reactProps")));
  assert.equal(await page.title(), "Koru");
  assert.equal(await page.locator('link[rel="manifest"]').getAttribute("href"), "/koru.webmanifest");
  assert.equal(await page.locator('link[rel="manifest"]').getAttribute("crossorigin"), "anonymous");
  assert.equal(await page.locator('meta[property="og:title"]').getAttribute("content"), "Koru");
  assert.equal(await page.locator('meta[property="og:image"]').getAttribute("content"), "https://koru.example/brand/koru-share-v1.png");
  assert.equal(await page.locator('meta[name="twitter:card"]').getAttribute("content"), "summary_large_image");
  assert.equal(await page.locator(".login-brand .koru-mark").count(), 1);
  const manifestResponse = await context.request.get(origin + "/koru.webmanifest");
  assert.equal(manifestResponse.status(), 200);
  assert.match(manifestResponse.headers()["content-type"], /application\/(?:manifest\+)?json/);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.name, "Koru"); assert.equal(manifest.id, "/");
  for (const icon of manifest.icons) {
    const response = await context.request.get(origin + icon.src);
    assert.equal(response.status(), 200);
    const png = await response.body();
    const size = Number(icon.sizes.split("x")[0]);
    assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
  const anonymousApi = await context.request.get(origin + "/api/state");
  assert.equal(anonymousApi.status(), 401);
  assert.ok(anonymousApi.headers()["cache-control"].includes("no-store"));
  check("Anonymous metadata, security headers, public manifest/icons and protected API");
  const botResponse = await context.request.get(origin + "/", { headers: { "User-Agent": "facebookexternalhit/1.1" } });
  assert.equal(botResponse.status(), 200);
  const botHtml = await botResponse.text();
  assert.ok(botHtml.includes("https://koru.example/brand/koru-share-v1.png"));
  assert.ok(!botHtml.includes("İkinci Okuma Grubu"));
  check("Anonymous link crawler follows root redirect to a public brand preview");

  // Capture all public appearance variants without modifying a real account or group.
  for (const width of [320,390,430,1440]) {
    await page.setViewportSize({ width, height:width === 1440 ? 1000 : 844 });
    for (const scheme of ["editorial","catalogue","notebook","minimal"]) for (const mode of ["light","dark"]) {
      await page.evaluate(({ scheme, mode }) => { localStorage.setItem("kitapTahlilScheme", scheme); localStorage.setItem("kitapTahlilColorMode", mode); }, { scheme, mode });
      await page.reload();
      await page.waitForFunction(() => Object.keys(document.getElementById("username") || {}).some((key) => key.startsWith("__reactProps")));
      await page.locator(`html[data-scheme="${scheme}"][data-color-mode="${mode}"]`).waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.ok(await page.locator(".login-brand .koru-mark").isVisible());
      assert.ok(await page.locator(".login-brand .koru-wordmark").evaluate((mark) => getComputedStyle(mark).fontFamily.includes("Bricolage")), "Corporate wordmark must not change typeface between themes");
      const panel = await page.locator(".login-panel").boundingBox();
      assert.ok(panel.x >= 0 && panel.x + panel.width <= width + 1);
      if (width < 681) {
        assert.ok(await page.locator("#username").evaluate((input) => parseFloat(getComputedStyle(input).fontSize) >= 16), "Mobile input must not trigger focus zoom");
        assert.ok((await page.getByRole("button", { name:"Giriş yap", exact:true }).boundingBox()).height >= 44);
      }
      await page.screenshot({ path:`${output}/login-${width}-${scheme}-${mode}.png`, animations:"disabled" });
      check(`Public identity ${width}px ${scheme} ${mode}`);
    }
  }
  assert.deepEqual(foreignFonts, []);
  check("Local Turkish font loading without third-party font requests");

  const socialPixels = await page.evaluate(async () => {
    const image = new Image(); image.src = "/brand/koru-share-v1.png"; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d"); ctx.drawImage(image,0,0);
    const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let ink = 0, yellow = 0;
    for (let i=0;i<pixels.length;i+=4) { if (pixels[i]<70 && pixels[i+1]<100 && pixels[i+2]<120) ink++; if (pixels[i]>180 && pixels[i+1]>150 && pixels[i+2]<110) yellow++; }
    return { width:canvas.width, height:canvas.height, ink, yellow };
  });
  assert.equal(socialPixels.width,1200); assert.equal(socialPixels.height,630);
  assert.ok(socialPixels.ink > 30_000 && socialPixels.yellow > 10_000, "Social card must contain actual mark/text, not a blank image");
  check("Social bitmap dimensions and nonblank brand pixels");
  const iconCorners = await page.evaluate(async () => {
    const result = [];
    for (const path of ["/brand/koru-apple-180.png", "/brand/koru-maskable-512.png"]) {
      const image = new Image(); image.src = path; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d"); ctx.drawImage(image,0,0);
      result.push(ctx.getImageData(0,0,1,1).data[3]);
    }
    return result;
  });
  assert.deepEqual(iconCorners, [255,255]);
  check("Apple and maskable app icons have opaque full-bleed corners");

  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL.endsWith("/koru-sw.js"));
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith("/koru-sw.js"));
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys(); const urls = [];
    for (const key of keys.filter((key) => key.startsWith("koru-public-shell-"))) for (const request of await (await caches.open(key)).keys()) urls.push(new URL(request.url).pathname);
    return urls;
  });
  assert.deepEqual(cached,["/offline.html"]);
  await context.setOffline(true);
  await page.goto(origin + "/?group=private-group");
  await page.getByRole("heading", { name:"Bağlantı yok", exact:true }).waitFor();
  assert.ok(!(await page.content()).includes("private-group"));
  await page.screenshot({ path:`${output}/offline.png` });
  await context.setOffline(false);
  await page.getByRole("link", { name:"Yeniden dene" }).click();
  await page.waitForURL((url) => url.pathname === "/login");
  await page.waitForFunction(() => Object.keys(document.getElementById("username") || {}).some((key) => key.startsWith("__reactProps")));
  check("Registered worker, public-only cache, offline navigation and online recovery");

  const { password } = JSON.parse(readFileSync(groupsSettingsPath,"utf8"));
  await page.getByLabel("Kullanıcı adı", { exact:true }).fill("demo.multi");
  await page.getByLabel("Şifre", { exact:true }).fill(password);
  await page.getByRole("button", { name:"Giriş yap", exact:true }).click();
  await page.waitForURL((url) => url.pathname === "/groups");
  assert.equal(await page.locator(".login-brand .koru-mark").count(), 1);
  await page.getByRole("button", { name:"Okuma Halkasi", exact:false }).click();
  await page.waitForURL((url) => url.pathname === "/" && url.searchParams.get("group") === "default");
  await page.locator(".featured-book-card").waitFor();
  originalAppearance = (await (await context.request.get(origin + "/api/state")).json()).readingGroup;
  await page.waitForFunction(() => document.title === "Okuma Halkasi");
  assert.equal(await page.locator('meta[name="application-name"]').getAttribute("content"), "Koru");
  assert.equal(await page.locator('meta[property="og:title"]').getAttribute("content"), "Koru");
  assert.equal((await (await context.request.get(origin + "/koru.webmanifest")).json()).name, "Koru");
  for (const width of [390,1440]) for (const mode of ["light","dark"]) {
    await context.request.patch(origin + "/api/groups/appearance", { headers:{ Origin:origin,"X-Reading-Group":"default" }, data:{ scheme:"notebook", mode } });
    await page.setViewportSize({ width, height:width === 1440 ? 1000 : 844 });
    await page.reload(); await page.locator(`html[data-color-mode="${mode}"]`).waitFor();
    await page.locator(".featured-book-card").waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.ok(await page.locator(width === 390 ? ".mobile-brand .koru-mark" : ".brand .koru-mark").isVisible());
    await page.screenshot({ path:`${output}/home-${width}-${mode}.png`, animations:"disabled" });
  }
  await page.setViewportSize({ width:390, height:844 });
  await page.evaluate(() => { window.scrollTo(0,0); document.documentElement.style.setProperty("--layout-safe-top", "32px"); document.documentElement.style.setProperty("--layout-safe-bottom", "24px"); });
  const insetGeometry = await page.evaluate(() => ({
    header:document.querySelector(".topbar").getBoundingClientRect().height,
    controlTop:document.querySelector(".topbar-tool").getBoundingClientRect().top,
    navBottom:Math.max(...[...document.querySelectorAll(".mobile-nav button")].map((button) => button.getBoundingClientRect().bottom)),
    height:innerHeight,
  }));
  assert.ok(insetGeometry.header >= 104 && insetGeometry.controlTop >= 32);
  assert.ok(insetGeometry.navBottom <= insetGeometry.height - 24);
  await page.screenshot({ path:`${output}/simulated-safe-area.png`, animations:"disabled" });
  await page.evaluate(() => { document.documentElement.style.removeProperty("--layout-safe-top"); document.documentElement.style.removeProperty("--layout-safe-bottom"); });
  check("Simulated notch and home-indicator insets leave controls unobscured");
  // A synthetic event checks command wiring, not physical browser installation acceptance.
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable:true });
    Object.assign(event, { prompt:async () => { document.documentElement.dataset.installPrompted="true"; }, userChoice:Promise.resolve({ outcome:"dismissed" }) });
    window.dispatchEvent(event);
  });
  await page.getByRole("button", { name:"Hesap menüsü", exact:true }).click();
  await page.getByRole("menuitem", { name:"Koru’yu yükle", exact:true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.installPrompted === "true");
  check("Private group title preserved, product metadata stable, logo and install command wiring");
  assert.deepEqual(errors, []);
  assert.deepEqual(hydrationErrors, []);
  writeFileSync(`${output}/report.json`,JSON.stringify({ date:new Date().toISOString(), status:"passed", checks, errors, hydrationErrors, physicalAndroid:"pending", physicalIos:"pending", realSocialPreviews:"pending" },null,2));
  console.log(`Passed ${checks.length} web/PWA checks. Physical device installation remains pending.`);
} finally {
  await context.setOffline(false);
  if (originalAppearance) await context.request.patch(origin + "/api/groups/appearance", { headers:{ Origin:origin,"X-Reading-Group":"default" }, data:{ scheme:originalAppearance.scheme, mode:originalAppearance.mode } }).catch(() => {});
  await browser.close();
}
