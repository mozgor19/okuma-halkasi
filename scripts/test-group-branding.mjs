import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { groupsSettingsPath, testOrigin, testOutputPath } from "./test-environment.mjs";

const origin = testOrigin;
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(origin).hostname)) throw new Error("Only loopback development environments may be tested.");
const { password } = JSON.parse(readFileSync(groupsSettingsPath, "utf8"));
const output = testOutputPath("group-branding");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
context.setDefaultTimeout(20_000);
context.setDefaultNavigationTimeout(45_000);
const page = await context.newPage();
const errors = [];
const checks = [];
page.on("pageerror", (error) => errors.push(error.message));
let originalAppearance;

async function brand(name) {
  await page.waitForFunction((value) => document.title === value, name);
  for (const selector of [".brand .group-brand-name", ".mobile-brand .group-brand-name", ".footer>span:first-child", ".hero h1 .theme-copy-default"]) {
    assert.equal(await page.locator(selector).textContent(), name, selector);
  }
  assert.equal(await page.locator(".breadcrumb-group").textContent(), name.toLocaleUpperCase("tr-TR"));
  for (const key of ["application-name", "apple-mobile-web-app-title"]) {
    assert.equal(await page.locator(`meta[name="${key}"]`).getAttribute("content"), name);
  }
}

async function select(name, id) {
  await page.getByRole("button", { name, exact: false }).click();
  await page.waitForURL((url) => url.pathname === "/" && url.searchParams.get("group") === id);
  await page.locator(".featured-book-card").waitFor();
  await brand(name);
  const html = await (await context.request.get(origin + "/?group=" + id)).text();
  const initial = await page.evaluate((html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return { title: doc.title, brand: doc.querySelector(".brand .group-brand-name")?.textContent };
  }, html);
  assert.deepEqual(initial, { title: name, brand: name }, "Initial HTML must already contain the selected name");
  const manifest = await context.request.get(origin + "/api/manifest");
  assert.equal(manifest.headers()["cache-control"], "private, no-store");
  assert.equal((await manifest.json()).name, name);
  assert.equal(await page.locator('link[rel="manifest"]').getAttribute("crossorigin"), "use-credentials");
  const calendar = await (await context.request.get(origin + "/api/calendar/1?group=" + id)).text();
  assert.ok(calendar.includes("X-WR-CALNAME:" + name));
  await page.screenshot({ path: `${output}/${id}.png`, animations: "disabled" });
  checks.push(`Selected ${id}: server HTML, all labels, title, install metadata, calendar`);
}

try {
  await page.goto(origin + "/login");
  assert.equal(await page.title(), "Okuma Halkası");
  assert.equal(await page.locator("#login-title").textContent(), "Okuma Halkası");
  const anonymous = await context.request.get(origin + "/api/manifest");
  assert.equal((await anonymous.json()).name, "Okuma Halkası");
  const invalid = await context.request.get(origin + "/api/manifest", { headers: { Cookie: "okuma_group=second; okuma_session=invalid" } });
  assert.equal((await invalid.json()).name, "Okuma Halkası", "A group cookie alone must not reveal the group's name");
  await page.waitForFunction(() => Object.keys(document.getElementById("username") || {}).some((key) => key.startsWith("__reactProps")));
  await page.getByLabel("Kullanıcı adı", { exact: true }).fill("demo.multi");
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/groups");
  assert.equal(await page.locator(".login-brand strong").textContent(), "Okuma Halkası");
  await select("Okuma Halkasi", "default");
  originalAppearance = (await (await context.request.get(origin + "/api/state")).json()).readingGroup;
  await page.locator(".mobile-nav").getByRole("button", { name: "Profil", exact: true }).click();
  await page.getByRole("button", { name: "Grup değiştir", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/groups");
  assert.equal(await page.locator(".login-brand strong").textContent(), "Okuma Halkasi");
  await select("İkinci Okuma Grubu", "second");
  await page.locator(".mobile-nav").getByRole("button", { name: "Profil", exact: true }).click();
  await page.getByRole("button", { name: "Grup değiştir", exact: true }).click();
  await select("Okuma Halkasi", "default");

  // Mock only display data; never rename the development registry or another user's group.
  let displayName;
  await page.route("**/api/state*", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.readingGroup.name = displayName;
    await route.fulfill({ response, json: data });
  });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) {
      for (const mode of ["light", "dark"]) {
        console.log(`Branding ${width}px ${scheme} ${mode}`);
        const response = await context.request.patch(origin + "/api/groups/appearance", {
          headers: { Origin: origin, "X-Reading-Group": "default" }, data: { scheme, mode },
        });
        assert.equal(response.status(), 200);
        for (const [kind, name] of [
          ["long", "İstanbul Edebiyat ve Medeniyet Okumaları İstişare Grubu"],
          ["unbroken", "UzunOkumaGrubu".repeat(8) + " <script>window.brandingInjected=true</script>"],
        ]) {
          displayName = name;
          await page.goto(origin + "/?group=default");
          await page.locator(`html[data-scheme="${scheme}"][data-color-mode="${mode}"]`).waitFor();
          await page.locator(".featured-book-card").waitFor();
          await brand(name);
          await page.evaluate(() => document.fonts.ready);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          assert.equal(await page.evaluate(() => window.brandingInjected), undefined);
          const brandButton = page.locator(width === 390 ? ".mobile-brand" : ".brand");
          const bounds = await brandButton.boundingBox();
          const label = await brandButton.locator(".group-brand-name").boundingBox();
          assert.ok(label.x >= bounds.x && label.x + label.width <= bounds.x + bounds.width + 1, "Name must stay inside its button");
          assert.ok(label.y + label.height <= bounds.y + bounds.height + 1, "Name must stay inside its button vertically");
          if (width === 390) {
            const actions = await page.locator(".topbar-actions").boundingBox();
            assert.ok(bounds.x + bounds.width <= actions.x + 1, "Group name must not overlap account controls");
          }
          const key = `${width}-${scheme}-${mode}-${kind}`;
          await page.screenshot({ path: `${output}/${key}.png`, animations: "disabled" });
          checks.push(key);
        }
      }
    }
  }
  assert.deepEqual(errors, []);
  writeFileSync(`${output}/report.json`, JSON.stringify({ date: new Date().toISOString(), checks, errors }, null, 2));
  console.log(`Passed group branding flows and ${checks.length} checks.`);
} finally {
  if (originalAppearance) await context.request.patch(origin + "/api/groups/appearance", {
    headers: { Origin: origin, "X-Reading-Group": "default" }, data: { scheme: originalAppearance.scheme, mode: originalAppearance.mode },
  }).catch(() => {});
  await browser.close();
}
