import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { readGroupsDevelopmentSettings } from "./groups-development.mjs";
import { testOrigin as origin, testOutputPath, testRunId } from "./test-environment.mjs";
import { checkMobileDialogs } from "./mobile-dialog-checks.mjs";
import { sourceIdentity } from "./release-source.mjs";

if (!testRunId || process.argv.length > 2) throw new Error("A named local production fixture environment is required.");
const output = testOutputPath("web-production");
mkdirSync(output, { recursive: true });
const checks = [], errors = [];
let passed = false;
let mobileDialogs = [];
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", serviceWorkers: "block" });
  const page = await context.newPage();
  page.on("pageerror", () => errors.push("Unhandled browser exception"));
  const response = await page.goto(origin + "/login");
  assert.equal(response.status(), 200);
  assert.equal((await response.text()).includes("Birinci Grup Kitabı"), false);
  assert.equal(await page.locator('script[src*="/@vite/client"]').count(), 0);
  const policy = response.headers()["content-security-policy"];
  const nonce = policy.match(/'nonce-([A-Za-z0-9+/=]+)'/)?.[1];
  assert.ok(nonce && Buffer.from(nonce, "base64").length >= 16);
  assert.match(policy, /'strict-dynamic'/);
  assert.doesNotMatch(policy, /'unsafe-inline'|'unsafe-eval'/);
  assert.match(response.headers()["cache-control"], /no-store/);
  await page.waitForFunction(() => Object.keys(document.getElementById("username") || {}).some((key) => key.startsWith("__reactProps")));
  const executable = await page.locator("script").evaluateAll((scripts) => scripts.filter((script) => !script.type || ["module", "text/javascript"].includes(script.type)).map((script) => script.nonce));
  assert.ok(executable.length > 1 && executable.every((value) => value === nonce));
  checks.push("Production nonce CSP covers appearance, framework bootstrap and streamed hydration; login is interactive");
  const forged = await context.request.get(origin + "/login", { headers: { "x-koru-nonce": "forged", "Content-Security-Policy": "script-src 'nonce-forged' 'unsafe-inline'" } });
  const nextNonce = forged.headers()["content-security-policy"].match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nextNonce && nextNonce !== nonce && nextNonce !== "forged");
  checks.push("Request-supplied nonces and policies are replaced; separate responses never reuse a nonce");
  const attack = await context.newPage();
  await attack.addInitScript(() => {
    window.__koruInjectionRan = false;
    window.__koruViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => window.__koruViolations.push(event.effectiveDirective));
  });
  // Parse attacker markup under the actual response policy. DevTools evaluate()
  // is privileged and is not evidence that an inline HTML payload was blocked.
  await attack.route(origin + "/login", (route) => route.fulfill({ status: 200, contentType: "text/html", headers: { "Content-Security-Policy": policy },
    body: '<!doctype html><html><body><script>window.__koruInjectionRan=true</script><button onclick="window.__koruInjectionRan=true">Injection test</button></body></html>' }));
  await attack.goto(origin + "/login");
  await attack.getByRole("button", { name: "Injection test" }).click();
  await attack.waitForFunction(() => window.__koruViolations.length >= 2);
  assert.equal(await attack.evaluate(() => window.__koruInjectionRan), false);
  await attack.close();
  checks.push("Real browser blocks injected inline scripts and event handlers");
  const login = await context.request.post(origin + "/api/auth/login", { headers: { Origin: origin }, data: { username: "demo.single", password: readGroupsDevelopmentSettings().password } });
  assert.equal(login.status(), 200);
  const firstDocument = await context.request.get(origin + "/");
  const html = await firstDocument.text();
  assert.ok(html.includes("Demo Tek Grup") && html.includes("Birinci Grup Kitabı"));
  assert.match(firstDocument.headers()["cache-control"], /no-store/);
  assert.equal(html.includes("İkinci Grup Kitabı"), false);
  const stateRequests = [];
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/state") stateRequests.push(request.url()); });
  await page.goto(origin + "/");
  await page.waitForFunction(() => document.querySelector(".person-picker strong")?.textContent?.includes("Demo"));
  await page.waitForFunction(() => Object.keys(document.querySelector(".person-picker") || {}).some((key) => key.startsWith("__reactProps")));
  assert.equal(stateRequests.length, 0);
  checks.push("Authenticated, no-store server document contains only its group and hydrates without the initial state waterfall");
  const state = await (await context.request.get(origin + "/api/state")).json();
  assert.equal(state.faceRecognitionEnabled, false);
  assert.ok(state.members.every((member) => member.faceReferenceMediaKey === null));
  const upload = await context.request.post(origin + "/api/upload", { headers: { Origin: origin, "X-Reading-Group": "default" }, multipart: { purpose: "faceReference" } });
  assert.equal(upload.status(), 403);
  const matching = await context.request.post(origin + "/api/action", { headers: { Origin: origin, "X-Reading-Group": "default" }, data: { action: "confirmDetectedAttendance", meetingId: 1, targetIds: [2] } });
  assert.equal(matching.status(), 403);
  checks.push("Public biometric opt-out is enforced by state, upload and attendance APIs, not only hidden controls");
  const other = await browser.newContext({ serviceWorkers: "block" });
  try {
    assert.equal((await other.request.post(origin + "/api/auth/login", { headers: { Origin: origin }, data: { username: "demo.multi", password: readGroupsDevelopmentSettings().password } })).status(), 200);
    assert.equal((await other.request.post(origin + "/api/groups", { headers: { Origin: origin, "X-Reading-Group": "second" }, data: { groupId: "second" } })).status(), 200);
    const second = await other.request.get(origin + "/?group=second");
    assert.equal(second.status(), 200);
    const document = await second.text();
    assert.ok(document.includes("İkinci Grup Kitabı"));
    assert.equal(document.includes("Birinci Grup Kitabı"), false);
    const denied = await other.request.get(origin + "/?group=default", { maxRedirects: 0 });
    assert.equal(denied.status(), 307);
    assert.equal((await other.request.post(origin + "/api/groups", { headers: { Origin: origin, "X-Reading-Group": "default" }, data: { groupId: "default" } })).status(), 200);
    const adminPage = await other.newPage();
    adminPage.on("pageerror", () => errors.push("Unhandled browser exception"));
    await adminPage.addInitScript(() => localStorage.setItem("kitapTahlilViewMode", "member"));
    await adminPage.goto(origin + "/?group=default");
    await adminPage.waitForFunction(() => document.querySelector(".person-picker strong")?.textContent?.includes("katılımcı görünümü"));
    await adminPage.getByRole("button", { name: "Hesap menüsü", exact: true }).click();
    await adminPage.getByRole("menuitem", { name: "Yönetici görünümüne dön", exact: true }).click();
    assert.equal(await adminPage.evaluate(() => localStorage.getItem("kitapTahlilViewMode")), "admin");
    const headers = { Origin: origin, "X-Reading-Group": "default" };
    assert.equal((await other.request.post(origin + "/api/account/experience", { headers, data: { kind: "tour", version: 1, state: "dismissed" } })).status(), 200);
    // The preview test's init script intentionally reapplies member mode on
    // every adminPage navigation. Form checks need a page without that script.
    const forms = await other.newPage();
    forms.on("pageerror", () => errors.push("Unhandled form browser exception"));
    mobileDialogs = await checkMobileDialogs(forms, other, origin, async name => {
      await forms.screenshot({ path: `${output}/form-${name}.png`, animations: "disabled" });
    }, [390]);
    await forms.close();
    assert.equal(mobileDialogs.length, 32);
    checks.push("Minified production CSS and hydrated form JS pass 32 normal-motion mobile dialog/keyboard/blur/zoom layouts with drafts and domain records preserved");
  } finally { await other.close(); }
  checks.push("Parallel-account server documents stay group-isolated; a conflicting group query cannot render private state");
  checks.push("Stored participant preview hydrates without a mismatch and can return to admin mode");
  for (const width of [390, 1440]) for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) for (const mode of ["light", "dark"]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const appearance = await context.request.patch(origin + "/api/groups/appearance", { headers: { Origin: origin, "X-Reading-Group": "default" }, data: { scheme, mode } });
    assert.equal(appearance.status(), 200);
    await page.reload();
    await page.waitForFunction(() => document.querySelector(".person-picker strong")?.textContent?.includes("Demo"));
    await page.locator(`html[data-scheme="${scheme}"][data-color-mode="${mode}"]`).waitFor();
    if (width === 390) await page.locator(".mobile-nav").getByRole("button", { name: "Profil", exact: true }).click();
    else await page.locator(".side-nav").getByRole("button", { name: "Profilim", exact: true }).click();
    await page.getByRole("tab", { name: "Güvenlik", exact: true }).click();
    await page.locator(".account-data-section").waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `${output}/${scheme}-${mode}-${width}.png`, fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "Kayıtlarda ara", exact: true }).click();
    await page.getByRole("heading", { name: "Kayıtlarda ara", exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+k");
    await page.getByRole("heading", { name: "Kayıtlarda ara", exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Yüz verisi", exact: true }).click();
    await page.getByRole("heading", { name: "Yüz eşleştirme kapalı", exact: true }).waitFor();
    assert.equal(await page.locator('.face-reference-section input[type="file"]').count(), 0);
  }
  const restore = await context.request.patch(origin + "/api/groups/appearance", { headers: { Origin: origin, "X-Reading-Group": "default" }, data: { scheme: state.readingGroup.scheme, mode: state.readingGroup.mode } });
  assert.equal(restore.status(), 200);
  checks.push("Lazy profile, search, keyboard search and disabled biometric panel work under CSP: 4 schemes x 2 modes x 390/1440px");
  assert.deepEqual(errors, []);
  checks.push("No unhandled browser exceptions in the production bundle");
  await context.close();
  passed = true;
  console.log(`PRODUCTION: ${checks.length} checks passed`);
} finally {
  await browser.close();
  writeFileSync(`${output}/report.json`, JSON.stringify({ ...sourceIdentity(), status: passed ? "passed" : "failed", checkedAt: new Date().toISOString(), checks, errors, mobileDialogs, scope: "Local production Chromium; not remote Workers CPU, Turnstile, or physical-device proof" }, null, 2));
}
