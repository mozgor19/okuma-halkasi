import assert from "node:assert/strict";
import { devices } from "playwright";

export async function checkAccountInstall(browser, origin, password, capture = async () => {}) {
  const checks = [], errors = [];
  // Account responses are mocked; a controlling SW would bypass page routing.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage(); page.setDefaultTimeout(15_000);
  page.on("pageerror", error => errors.push(error.message));
  const headers = { Origin: origin, "X-Reading-Group": "default" };
  const hydrate = async (target, path = "/login") => {
    await target.goto(origin + path);
    await target.waitForFunction(() => [...document.querySelectorAll("button,input")].some(element => Object.keys(element).some(key => key.startsWith("__reactProps"))));
    await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const offer = (target, outcome = "dismissed", failure = false) => target.evaluate(({ outcome, failure }) => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        document.documentElement.dataset.installCalls = String(Number(document.documentElement.dataset.installCalls || 0) + 1);
        if (failure) throw new Error("Synthetic install failure");
      },
      userChoice: Promise.resolve({ outcome }),
    });
    window.dispatchEvent(event);
  }, { outcome, failure });
  const notice = target => target.getByRole("complementary", { name: "Koru’yu ana ekrana ekle" });
  let before, appearance;
  try {
    assert.equal((await context.request.post(origin + "/api/auth/login", { headers, data: { username: "demo.multi", password } })).status(), 200);
    assert.equal((await context.request.post(origin + "/api/groups", { headers, data: { groupId: "default" } })).status(), 200);
    before = await (await context.request.get(origin + "/api/state", { headers })).json();
    appearance = (await (await context.request.get(origin + "/api/groups")).json()).groups.find(group => group.id === "default");
    let verified = false, unavailable = false;
    await page.route("**/api/onboarding/account", route => route.fulfill({ status: unavailable ? 503 : 200, contentType: "application/json",
      body: JSON.stringify(unavailable ? { error: "Synthetic unavailable" } : { username: "demo.multi", name: "Demo", email: verified ? "demo@example.test" : null, verified }) }));
    await hydrate(page, "/?group=default");
    await page.getByRole("button", { name: "Bildirimler", exact: true }).click();
    const reminder = page.getByRole("menuitem", { name: /E-posta adresini doğrula/ });
    await reminder.waitFor();
    assert.equal(await reminder.getAttribute("href"), "/account");
    await reminder.click();
    await page.waitForURL(origin + "/account");
    await page.getByRole("heading", { name: "Hesabım", exact: true }).waitFor();
    checks.push("Unverified account notification opens the existing email verification/account screen");

    verified = true;
    await hydrate(page, "/?group=default");
    await page.getByRole("button", { name: "Bildirimler", exact: true }).click();
    await reminder.waitFor({ state: "hidden" });
    await page.keyboard.press("Escape");
    verified = false;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.getByRole("button", { name: "Bildirimler", exact: true }).click();
    await reminder.waitFor();
    await page.keyboard.press("Escape");
    verified = true;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForResponse(response => response.url().endsWith("/api/onboarding/account"));
    await page.getByRole("button", { name: "Bildirimler", exact: true }).click();
    await reminder.waitFor({ state: "hidden" });
    await page.keyboard.press("Escape");
    checks.push("Account focus refresh removes the reminder after verification without changing meeting notifications");
    unavailable = true;
    await hydrate(page, "/?group=default");
    await page.getByRole("button", { name: "Bildirimler", exact: true }).click();
    await reminder.waitFor({ state: "hidden" });
    await page.keyboard.press("Escape");
    checks.push("An unavailable account response does not falsely mark an account unverified");

    await hydrate(page);
    await offer(page);
    await notice(page).waitFor();
    await page.evaluate(() => { const modal = document.createElement("div"); modal.id = "test-modal"; modal.setAttribute("role", "dialog"); document.body.append(modal); });
    await notice(page).waitFor({ state: "hidden" });
    await page.evaluate(() => document.getElementById("test-modal").remove());
    await notice(page).waitFor();
    await page.evaluate(() => document.documentElement.setAttribute("data-keyboard-open", ""));
    await notice(page).waitFor({ state: "hidden" });
    await page.evaluate(() => document.documentElement.removeAttribute("data-keyboard-open"));
    await notice(page).waitFor();
    checks.push("Mobile offer waits behind dialogs/tour and keyboard");
    await notice(page).getByRole("button", { name: "Ana ekrana ekle", exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.installCalls === "1");
    await notice(page).waitFor({ state: "hidden" });
    await hydrate(page); await offer(page);
    assert.equal(await notice(page).count(), 0);
    checks.push("One tap calls the browser prompt once; dismissal survives navigation/reload");
    await hydrate(page, "/?group=default"); await offer(page);
    await page.getByRole("button", { name: "Hesap menüsü", exact: true }).click();
    await page.getByRole("menuitem", { name: "Koru’yu yükle", exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.installCalls === "1");
    checks.push("Existing account-menu installation remains usable after dismissing the automatic offer");

    await page.evaluate(() => localStorage.removeItem("koru-install-dismissed-v1"));
    await hydrate(page); await offer(page, "accepted");
    await notice(page).getByRole("button", { name: "Ana ekrana ekle", exact: true }).click();
    await notice(page).waitFor({ state: "hidden" });
    checks.push("Accepted installation clears the offer");
    await hydrate(page); await offer(page);
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await notice(page).waitFor({ state: "hidden" });
    checks.push("Browser appinstalled event clears installation controls");
    await hydrate(page); await offer(page, "dismissed", true);
    await notice(page).getByRole("button", { name: "Ana ekrana ekle", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Kurulum açılamadı" }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.installCalls), "1");
    checks.push("Rejected browser prompt shows an honest error, not installation success");

    const ios = await browser.newContext({ ...devices["iPhone 13"], locale: "tr-TR", serviceWorkers: "block" });
    const phone = await ios.newPage(); phone.setDefaultTimeout(15_000);
    phone.on("pageerror", error => errors.push(error.message));
    try {
      await hydrate(phone);
      await notice(phone).waitFor();
      await notice(phone).getByRole("button", { name: "Ana ekrana ekle", exact: true }).click();
      const guide = phone.getByRole("dialog", { name: "Koru’yu ana ekrana ekle" });
      await guide.waitFor();
      assert.match(await guide.innerText(), /Paylaş/);
      assert.match(await guide.innerText(), /Ana Ekrana Ekle/);
      for (const width of [320, 1440]) for (const scheme of ["notebook", "editorial", "catalogue", "minimal"]) for (const dark of [false, true]) {
        await phone.setViewportSize({ width, height: 844 });
        await phone.evaluate(({ scheme, dark }) => { document.documentElement.dataset.scheme = scheme; document.documentElement.classList.toggle("dark", dark); }, { scheme, dark });
        const r = await guide.boundingBox(); assert.ok(r.x >= 0 && r.x + r.width <= width && r.y >= 0 && r.y + r.height <= 844);
        await capture(phone, `${width}-${scheme}-${dark ? "dark" : "light"}-ios-guide`);
      }
      await guide.getByRole("button", { name: "Tamam", exact: true }).click();
      await hydrate(phone); assert.equal(await notice(phone).count(), 0);
      checks.push("iPhone shows real Share/Add to Home Screen steps; dismissal persists");
      await phone.evaluate(() => localStorage.removeItem("koru-install-dismissed-v1"));
      await hydrate(phone, "/reset-password"); assert.equal(await notice(phone).count(), 0);
      await hydrate(phone, "/register"); assert.equal(await notice(phone).count(), 0);
      await phone.addInitScript(() => Object.defineProperty(navigator, "standalone", { configurable: true, value: true }));
      await hydrate(phone); assert.equal(await notice(phone).count(), 0);
      checks.push("No automatic offer on password/signup screens or installed iOS app");
    } finally { await ios.close(); }

    await hydrate(page); await offer(page);
    await page.evaluate(() => { window.ReactNativeWebView = { postMessage() {} }; window.dispatchEvent(new Event("okuma:native-ready")); });
    await notice(page).waitFor({ state: "hidden" });
    checks.push("Late native-shell injection suppresses the web install offer");

    unavailable = false; verified = false;
    for (const width of [320, 1440]) for (const scheme of ["notebook", "editorial", "catalogue", "minimal"]) for (const mode of ["light", "dark"]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      assert.equal((await context.request.patch(origin + "/api/groups/appearance", { headers, data: { scheme, mode } })).status(), 200);
      await page.evaluate(() => localStorage.removeItem("koru-install-dismissed-v1"));
      await hydrate(page, "/?group=default"); await offer(page);
      if (width === 320) await notice(page).waitFor();
      else assert.equal(await notice(page).count(), 0);
      const geometry = await page.evaluate(() => [...document.querySelectorAll(".pwa-install-notice,.pwa-install-notice button")].map(el => {
        const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height, width: r.width };
      }));
      assert.ok(geometry.every(r => r.left >= 0 && r.right <= width && r.top >= 0 && r.bottom <= 844));
      assert.ok(geometry.slice(1).every(r => r.height >= 44 && r.width >= 44));
      await capture(page, `${width}-${scheme}-${mode}-install`);
      await page.getByRole("button", { name: "Bildirimler", exact: true }).click();
      await reminder.waitFor();
      const r = await reminder.boundingBox(); assert.ok(r.x >= 0 && r.x + r.width <= width && r.height >= 44);
      await capture(page, `${width}-${scheme}-${mode}-notification`);
      await page.keyboard.press("Escape");
    }
    checks.push("Four schemes/light-dark at320/1440: contained controls,44px targets, no desktop automatic offer");
    const after = await (await context.request.get(origin + "/api/state", { headers })).json();
    for (const key of ["books", "meetings", "roadmap"]) assert.deepEqual(after[key], before[key]);
    assert.deepEqual(errors, []);
    return checks;
  } catch (error) {
    error.checks = checks;
    throw error;
  } finally {
    if (appearance) await context.request.patch(origin + "/api/groups/appearance", { headers, data: { scheme: appearance.scheme, mode: appearance.mode } });
    await context.close();
  }
}
