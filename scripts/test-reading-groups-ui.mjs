import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const origin = new URL(process.env.OKUMA_TEST_ORIGIN || "http://127.0.0.1:5174").origin;
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(origin).hostname)) throw new Error("Only loopback development environments may be tested.");
const { password } = JSON.parse(readFileSync(".sites-runtime/groups-development.json", "utf8"));
const output = "outputs/groups-ui";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const results = [];
const errors = [];
async function watch(context) {
  context.setDefaultTimeout(20_000);
  context.setDefaultNavigationTimeout(45_000);
  context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
}
async function login(page, username) {
  await page.goto(origin + "/login");
  await page.waitForFunction(() => {
    const input = document.getElementById("username");
    return input && Object.keys(input).some((key) => key.startsWith("__reactProps"));
  });
  await page.getByLabel("Kullanıcı adı", { exact: true }).fill(username);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Giriş yap/ }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}
async function nav(page, view) {
  const width = page.viewportSize().width;
  const root = width < 768 ? page.locator(".mobile-nav") : page.locator(".side-nav");
  await root.getByRole("button", { name: view, exact: true }).click();
}
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator("main.content").waitFor();
  const geometry = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(geometry.scroll <= geometry.width + 1, `${name}: horizontal document overflow ${geometry.scroll}/${geometry.width}`);
  const missing = await page.locator("img:visible").evaluateAll((images) => images.filter((img) => img.complete && !img.naturalWidth).map((img) => img.getAttribute("src")));
  assert.deepEqual(missing, [], `${name}: failed images`);
  await page.screenshot({ path: `${output}/${name}.png`, animations: "disabled" });
  results.push({ name, ...geometry });
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await watch(context);
  const page = await context.newPage();
  await login(page, "demo.single");
  assert.equal(new URL(page.url()).pathname, "/");
  await page.getByRole("heading", { name: "Birinci Grup Kitabı", exact: true }).first().waitFor();
  await capture(page, "single-notebook-home");
  await context.close();

  const multi = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await watch(multi);
  const account = await multi.newPage();
  await login(account, "demo.multi");
  assert.equal(new URL(account.url()).pathname, "/groups");
  await account.getByRole("heading", { name: "Grubunu seç" }).waitFor();
  await account.getByRole("button", { name: /Okuma Halkasi/ }).waitFor();
  await account.screenshot({ path: `${output}/group-selection.png`, animations: "disabled" });
  await account.getByRole("button", { name: /Okuma Halkasi/ }).click();
  await account.waitForURL((url) => url.pathname === "/");
  await account.getByRole("heading", { name: "Birinci Grup Kitabı", exact: true }).first().waitFor();

  const stale = await multi.newPage();
  await stale.goto(origin + "/?meeting=1&group=default");
  try { await stale.locator(".participation-card").waitFor(); }
  catch (error) { console.error({ url: stale.url(), body: (await stale.locator("body").innerText()).slice(0, 1800) }); throw error; }
  await nav(account, "Profil");
  await account.getByRole("button", { name: "Grup değiştir" }).click();
  await account.getByRole("button", { name: /İkinci Okuma Grubu/ }).click();
  await account.waitForURL((url) => url.pathname === "/" && url.searchParams.get("group") === "second");
  await account.locator(".app-shell").waitFor();
  await account.locator(".featured-book-card").waitFor();
  assert.equal(await account.getByRole("button", { name: "Yeni buluşma oluştur", exact: true }).count(), 0);
  await account.getByRole("heading", { name: "İkinci Grup Kitabı", exact: true }).first().waitFor();
  await stale.locator(".meeting-title-actions .favorite").click();
  await stale.waitForURL((url) => url.pathname === "/groups");
  await stale.close();
  await nav(account, "Profil");
  await account.getByRole("button", { name: "Grup değiştir" }).click();
  await account.getByRole("button", { name: /Okuma Halkasi/ }).click();
  await account.waitForURL((url) => url.pathname === "/" && url.searchParams.get("group") === "default");

  // Scheme changes are persisted through the real API before each page is loaded.
  for (const width of [390, 1440]) {
    await account.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) {
      for (const mode of ["light", "dark"]) {
        console.log(`Checking ${width}px ${scheme} ${mode}`);
        const response = await multi.request.patch(origin + "/api/groups/appearance", {
          headers: { Origin: origin, "X-Reading-Group": "default" }, data: { scheme, mode },
        });
        assert.equal(response.status(), 200);
        const initialHtml = await (await multi.request.get(origin + "/?group=default")).text();
        const firstPaint = await account.evaluate((html) => {
          const root = new DOMParser().parseFromString(html, "text/html").documentElement;
          return { scheme: root.dataset.scheme, mode: root.dataset.mode };
        }, initialHtml);
        assert.deepEqual(firstPaint, { scheme, mode }, "Group appearance must be present in server-rendered HTML");
        await account.goto(origin + "/?group=default");
        await account.locator(`html[data-scheme="${scheme}"][data-color-mode="${mode}"]`).waitFor();
        await account.getByRole("heading", { name: "Birinci Grup Kitabı", exact: true }).first().waitFor();
        const prefix = `${width}-${scheme}-${mode}`;
        await capture(account, `${prefix}-home`);
        await nav(account, "Buluşmalar");
        await capture(account, `${prefix}-archive`);
        await nav(account, width < 768 ? "Plan" : /Gelecek kitaplar|Plan/);
        await capture(account, `${prefix}-plan`);
        await account.goto(origin + "/?meeting=1&group=default");
        await account.locator(".participation-card").waitFor();
        await capture(account, `${prefix}-meeting`);
        // Background synchronization must not replace an unsaved review.
        await account.locator("#comment").fill("Unsaved synthetic comment");
        await account.evaluate(() => window.dispatchEvent(new Event("okuma:resume")));
        assert.equal(await account.locator("#comment").inputValue(), "Unsaved synthetic comment");
        await nav(account, width < 768 ? "Profil" : "Profilim");
        for (const tab of ["Özet", "Kitaplarım", "Galerim", "Görünüm", "Güvenlik", "Yüz verisi", "Çöp kutusu", "Yönetim"]) {
          await account.getByRole("tab", { name: tab, exact: true }).click();
          await capture(account, `${prefix}-profile-${tab.replace(/[^a-zA-Z0-9]/g, "_")}`);
        }
      }
    }
  }
  // A fresh login must show selection again, even when an old cookie exists.
  await account.goto(origin + "/login"); // Existing session redirects back as expected.
  await multi.request.post(origin + "/api/auth/login", { data: { username: "demo.multi", password } });
  await account.goto(origin + "/?meeting=1&group=second");
  await account.getByRole("heading", { name: "Grubunu seç" }).waitFor();
  await account.getByRole("button", { name: /İkinci Okuma Grubu/ }).click();
  await account.locator(".meeting-head h1").waitFor();
  assert.equal(await account.locator(".meeting-head h1").textContent(), "İkinci Grup Kitabı");
  await multi.request.patch(origin + "/api/groups/appearance", { headers: { Origin: origin, "X-Reading-Group": "second" }, data: { scheme: "catalogue", mode: "light" } });
  await multi.request.post(origin + "/api/groups", { headers: { Origin: origin, "X-Reading-Group": "default" }, data: { groupId: "default" } });
  await multi.request.patch(origin + "/api/groups/appearance", { headers: { Origin: origin, "X-Reading-Group": "default" }, data: { scheme: "notebook", mode: "system" } });
  await account.goto(origin + "/?group=default");
  await account.locator(".featured-book-card").waitFor();
  // The native adapter can appear after the notification center has already mounted.
  await account.evaluate(() => {
    window.ReactNativeWebView = { postMessage(raw) {
      const request = JSON.parse(raw);
      if (request.type === "notifications:status") {
        window.dispatchEvent(new CustomEvent("okuma:native-result", { detail: { id: request.id, ok: true, permission: "denied" } }));
      }
    } };
    window.__okumaShell = { notifications: true };
    window.dispatchEvent(new CustomEvent("okuma:native-ready"));
  });
  await account.getByRole("button", { name: "Bildirimler", exact: true }).click();
  await account.getByText("Bildirim izni cihaz ayarlarından kapalı.", { exact: true }).waitFor();
  assert.deepEqual(errors, [], "Unexpected browser errors");
  await multi.close();
  writeFileSync(`${output}/report.json`, JSON.stringify({ date: new Date().toISOString(), results, errors }, null, 2));
  console.log(`Passed UI flows and ${results.length} visual/layout checks across four schemes, two modes and two viewport widths.`);
} finally { await browser.close(); }
