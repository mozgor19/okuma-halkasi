import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:5175";
const { password } = JSON.parse(readFileSync(".sites-runtime/groups-development.json", "utf8"));
const browser = await chromium.launch({ args: ["--no-sandbox"] });
mkdirSync("outputs/legacy-web", { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  context.setDefaultTimeout(20_000);
  context.setDefaultNavigationTimeout(45_000);
  const login = await context.request.post(origin + "/api/auth/login", { data: { username: "demo.multi", password } });
  assert.equal(login.status(), 200);
  assert.deepEqual(await login.json(), { ok: true });
  assert.equal((await context.request.post(origin + "/api/auth/login", { data: { username: "demo.none", password } })).status(), 403);
  const state = await (await context.request.get(origin + "/api/state")).json();
  assert.equal(state.readingGroup, undefined);
  assert.equal(state.books.find((book) => book.id === 1).title, "Birinci Grup Kitabı");
  const groups = await context.request.get(origin + "/api/groups");
  assert.deepEqual(await groups.json(), { enabled: false, groups: [], selectedGroupId: null });
  assert.equal((await context.request.patch(origin + "/api/groups/appearance", { data: { scheme: "minimal" } })).status(), 404);
  const mutation = await context.request.post(origin + "/api/action", {
    headers: { Origin: origin }, data: { action: "toggleFavorite", bookId: 1, active: true },
  });
  assert.equal(mutation.status(), 200, "Legacy mutations must not require a group header");
  for (const path of ["/api/state?group=second", "/?meeting=1&group=second"]) {
    const blocked = await context.request.get(origin + path);
    assert.equal(blocked.status(), 503, "A disabled second group must never fall back to the default database");
    assert.equal((await blocked.json()).code, "GROUP_DISABLED");
  }
  assert.equal((await context.request.post(origin + "/api/action", {
    headers: { Origin: origin, "X-Reading-Group": "second" }, data: { action: "toggleFavorite", bookId: 1, active: false },
  })).status(), 503);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) {
    for (const mode of ["light", "dark"]) {
      console.log(`Legacy ${scheme} ${mode}`);
      await page.goto(origin + "/");
      await page.evaluate(({ scheme, mode }) => {
        localStorage.setItem("kitapTahlilScheme", scheme);
        localStorage.setItem("kitapTahlilColorMode", mode);
      }, { scheme, mode });
      await page.reload();
      await page.locator(`html[data-scheme="${scheme}"][data-color-mode="${mode}"]`).waitFor();
      assert.equal(await page.title(), "Kitap Tahlil & İstişare");
      assert.equal(await page.locator(".mobile-brand .group-brand-name").textContent(), "Kitap Tahlil & İstişare");
      assert.equal(await page.locator('meta[name="application-name"]').getAttribute("content"), "Kitap Tahlil ve İstişare");
      assert.equal(await page.locator('link[rel="manifest"]').getAttribute("href"), "/manifest.webmanifest");
      try { await page.locator(".featured-book-card").waitFor(); }
      catch (error) { console.error({ url: page.url(), body: (await page.locator("body").innerText()).slice(0, 1800) }); throw error; }
      await page.locator(".mobile-nav").getByRole("button", { name: "Profil", exact: true }).click();
      assert.equal(await page.getByRole("button", { name: "Grup değiştir" }).count(), 0);
      await page.getByRole("tab", { name: "Görünüm", exact: true }).click();
      await page.screenshot({ path: `outputs/legacy-web/${scheme}-${mode}.png`, animations: "disabled" });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
  }
  assert.deepEqual(errors, []);
  await context.close();
  console.log("Legacy web: login, state, mutation, hidden group UI and eight appearance combinations passed with feature disabled.");
} finally { await browser.close(); }
