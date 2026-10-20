import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { TOUR_VERSION } from "../lib/web-experience-policy.ts";
import { KORU_BRAND, KORU_MARK_PATHS } from "../lib/brand-identity.ts";
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
let passed = false;
writeFileSync(`${output}/report.json`, JSON.stringify({ status:"running", date:new Date().toISOString(), checks:[] }));
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
  assert.equal(await page.locator('meta[property="og:image"]').getAttribute("content"), "https://koru.example" + KORU_BRAND.socialImage);
  assert.equal(await page.locator('meta[name="twitter:card"]').getAttribute("content"), "summary_large_image");
  assert.equal(await page.locator(".login-brand .koru-mark").count(), 1);
  assert.deepEqual(await page.locator(".login-brand .koru-mark path").evaluateAll((paths) => paths.map((path) => path.getAttribute("d"))), [...KORU_MARK_PATHS]);
  assert.equal(await page.locator('link[rel="apple-touch-icon"]').getAttribute("href"), KORU_BRAND.appleIcon);
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
  assert.ok(botHtml.includes("https://koru.example" + KORU_BRAND.socialImage));
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

  const smallMarks = await page.evaluate(async (paths) => {
    const results = [];
    for (const size of [16, 20, 24, 32]) for (const color of ["#172d45", "#fffdf7"]) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="currentColor" style="color:${color}">${paths.map((path) => `<path d="${path}"/>`).join("")}</svg>`;
      const image = new Image(); image.src = "data:image/svg+xml," + encodeURIComponent(svg); await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0, size, size);
      const pixels = ctx.getImageData(0, 0, size, size).data;
      let ink = 0, clear = 0;
      for (let index = 3; index < pixels.length; index += 4) { if (pixels[index] > 128) ink++; if (pixels[index] === 0) clear++; }
      results.push({ size, color, ink, clear });
    }
    return results;
  }, [...KORU_MARK_PATHS]);
  for (let index = 0; index < smallMarks.length; index += 2) {
    const light = smallMarks[index], dark = smallMarks[index + 1];
    assert.ok(light.ink > light.size ** 2 * 0.2 && light.clear > light.size ** 2 * 0.3);
    assert.equal(light.ink, dark.ink); assert.equal(light.clear, dark.clear);
  }
  check("16/20/24/32px monochrome marks retain ink and negative space in both colors");

  const socialPixels = await page.evaluate(async (path) => {
    const image = new Image(); image.src = path; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d"); ctx.drawImage(image,0,0);
    const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let ink = 0, yellow = 0;
    for (let i=0;i<pixels.length;i+=4) { if (pixels[i]<70 && pixels[i+1]<100 && pixels[i+2]<120) ink++; if (pixels[i]>180 && pixels[i+1]>150 && pixels[i+2]<110) yellow++; }
    return { width:canvas.width, height:canvas.height, ink, yellow };
  }, KORU_BRAND.socialImage);
  assert.equal(socialPixels.width,1200); assert.equal(socialPixels.height,630);
  assert.ok(socialPixels.ink > 30_000 && socialPixels.yellow > 10_000, "Social card must contain actual mark/text, not a blank image");
  check("Social bitmap dimensions and nonblank brand pixels");
  const iconCorners = await page.evaluate(async (paths) => {
    const result = [];
    for (const path of paths) {
      const image = new Image(); image.src = path; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d"); ctx.drawImage(image,0,0);
      result.push(ctx.getImageData(0,0,1,1).data[3]);
    }
    return result;
  }, [KORU_BRAND.appleIcon, KORU_BRAND.maskableIcon]);
  assert.deepEqual(iconCorners, [255,255]);
  check("Apple and maskable app icons have opaque full-bleed corners");

  const maskPixels = await page.evaluate(async (path) => {
    const image = new Image(); image.src = path; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, 512, 512).data;
    let ink = 0, outside = 0;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const index = (y * 512 + x) * 4;
      if (pixels[index] < 70 && pixels[index + 1] < 100 && pixels[index + 2] < 120) {
        ink++;
        if (Math.hypot(x + 0.5 - 256, y + 0.5 - 256) > 204.8) outside++;
      }
    }
    return { ink, outside };
  }, KORU_BRAND.maskableIcon);
  assert.ok(maskPixels.ink > 10_000);
  assert.equal(maskPixels.outside, 0, "The complete mark must fit the maskable 80% safe circle");
  check("Approved maskable book-and-leaf mark stays inside the installation safe circle");

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
  assert.deepEqual(await page.locator(".wordmark svg path").evaluateAll((paths) => paths.map((path) => path.getAttribute("d"))), [...KORU_MARK_PATHS]);
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
  const experienceResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/account/experience" && response.request().method() === "GET" && response.status() === 200);
  await page.getByRole("button", { name:"Okuma Halkasi", exact:false }).click();
  await page.waitForURL((url) => url.pathname === "/" && url.searchParams.get("group") === "default");
  await page.locator(".featured-book-card").waitFor();
  await page.waitForFunction(() => Object.keys(document.querySelector(".person-picker") || {}).some((key) => key.startsWith("__reactProps")));
  const experience = await (await experienceResponse).json();
  if (experience.available && experience.tourEligible && !(experience.tour?.version >= TOUR_VERSION)) {
    await page.locator(".experience-dialog").getByRole("button", { name:"Daha sonra", exact:true }).click();
    await page.locator(".experience-dialog").waitFor({ state:"hidden" });
    const deferred = await (await context.request.get(origin + "/api/account/experience")).json();
    assert.deepEqual(deferred.tour, { version:TOUR_VERSION, state:"dismissed" });
    check("First-use tour can be deferred before interacting with the installed-app controls");
  }
  originalAppearance = (await (await context.request.get(origin + "/api/state")).json()).readingGroup;
  await page.waitForFunction(() => document.title === "Okuma Halkasi");
  assert.equal(await page.locator('meta[name="application-name"]').getAttribute("content"), "Koru");
  assert.equal(await page.locator('meta[property="og:title"]').getAttribute("content"), "Koru");
  assert.equal((await (await context.request.get(origin + "/koru.webmanifest")).json()).name, "Koru");
  for (const width of [390,1440]) for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) for (const mode of ["light","dark"]) {
    const appearance = await context.request.patch(origin + "/api/groups/appearance", { headers:{ Origin:origin,"X-Reading-Group":"default" }, data:{ scheme, mode } });
    assert.equal(appearance.status(), 200);
    await page.setViewportSize({ width, height:width === 1440 ? 1000 : 844 });
    await page.goto(origin + "/?group=default"); await page.locator(`html[data-scheme="${scheme}"][data-color-mode="${mode}"]`).waitFor();
    await page.locator(".featured-book-card").waitFor();
    await page.waitForFunction(() => Object.keys(document.querySelector(".person-picker") || {}).some((key) => key.startsWith("__reactProps")));
    const prefix = `${width}-${scheme}-${mode}`;
    const capture = async (view) => {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const mark = page.locator(width === 390 ? ".mobile-brand .koru-mark" : ".brand .koru-mark");
      assert.ok(await mark.isVisible());
      assert.deepEqual(await mark.locator("path").evaluateAll((paths) => paths.map((path) => path.getAttribute("d"))), [...KORU_MARK_PATHS]);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path:`${output}/${prefix}-${view}.png`, animations:"disabled" });
    };
    await capture("home");
    const nav = page.locator(width === 390 ? ".mobile-nav" : ".side-nav");
    await nav.getByRole("button", { name:width === 390 ? "Plan" : /Gelecek kitaplar|Plan/ }).click();
    await capture("plan");
    await page.goto(origin + "/?meeting=1&group=default");
    await page.locator(".participation-card").waitFor(); await capture("meeting");
    await nav.getByRole("button", { name:width === 390 ? "Profil" : "Profilim", exact:true }).click();
    let tabIndex = 0;
    for (const tab of ["Özet", "Kitaplarım", "Galerim", "Görünüm", "Güvenlik", "Yüz verisi", "Çöp kutusu", "Yönetim"]) {
      await page.getByRole("tab", { name:tab, exact:true }).click();
      await capture(`profile-${tabIndex++}`);
    }
    check(`Approved mark on Home, Plan, Meeting and every Profile tab: ${prefix}`);
  }
  const restoreForInsets = await context.request.patch(origin + "/api/groups/appearance", { headers:{ Origin:origin,"X-Reading-Group":"default" }, data:{ scheme:"notebook", mode:"dark" } });
  assert.equal(restoreForInsets.status(), 200);
  await page.goto(origin + "/?group=default"); await page.locator(".featured-book-card").waitFor();
  await page.waitForFunction(() => Object.keys(document.querySelector(".person-picker") || {}).some((key) => key.startsWith("__reactProps")));
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
  passed = true;
  console.log(`Passed ${checks.length} web/PWA checks. Physical device installation remains pending.`);
} finally {
  await context.setOffline(false);
  if (originalAppearance) await context.request.patch(origin + "/api/groups/appearance", { headers:{ Origin:origin,"X-Reading-Group":"default" }, data:{ scheme:originalAppearance.scheme, mode:originalAppearance.mode } }).catch(() => {});
  await browser.close();
  writeFileSync(`${output}/report.json`,JSON.stringify({ date:new Date().toISOString(), status:passed ? "passed" : "failed", checks, errors, hydrationErrors, physicalAndroid:"pending", physicalIos:"pending", realSocialPreviews:"pending" },null,2));
}
