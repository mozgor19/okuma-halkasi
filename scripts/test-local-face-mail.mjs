import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium, webkit } from "playwright";
import { readGroupsDevelopmentSettings } from "./groups-development.mjs";
import { testOrigin as origin, testOutputPath, testRunId } from "./test-environment.mjs";
import { sourceIdentity } from "./release-source.mjs";
const ts = createRequire(import.meta.url)("typescript");
if (!testRunId) throw Error("Isolated local fixture required");
const engine = process.argv.includes("--webkit") ? "webkit" : "chromium";
const output = testOutputPath("local-face-mail-" + engine); mkdirSync(output, { recursive: true });
const browser = await (engine === "webkit" ? webkit : chromium).launch({ ...(engine === "webkit" && process.env.KORU_WEBKIT_EXECUTABLE ? { executablePath: process.env.KORU_WEBKIT_EXECUTABLE } : {}), ...(engine === "chromium" ? { args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", reducedMotion: "reduce" });
const page = await context.newPage(), checks = [], errors = [], requests = [];
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => requests.push({ url: request.url(), method: request.method() }));
page.setDefaultTimeout(25000);
let status = "failed", failure;
try {
  await page.goto(origin + "/login");
  const workerPath = "/_next/static/" + readdirSync("dist/client/_next/static").find(name => /^local-face\.worker-.*\.js$/.test(name));
  const before = requests.length;
  const workerResult = await page.evaluate(async workerPath => {
    const worker = new Worker(workerPath, { type: "module" }); let id = 0;
    const run = (action, extra = {}) => new Promise((resolve, reject) => {
      const requestId = ++id, timeout = setTimeout(() => reject(Error("Worker timeout")), 120000);
      worker.onmessage = event => { if (event.data.id === requestId) { clearTimeout(timeout); resolve(event.data); } };
      worker.onerror = event => { clearTimeout(timeout); reject(Error(event.message)); };
      worker.postMessage({ id: requestId, action, scope: { groupId: "synthetic-only", ownerId: 99001 }, ...extra });
    });
    let beats = 0; const timer = setInterval(() => beats++, 16);
    try {
      const listed = await run("list");
      const noConsent = await run("enroll", { memberId: 1 });
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 200;
      const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 200, 200);
      const file = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      const blank = await run("enroll", { memberId: 1, consent: "local-face-2026-10-22", file });
      const repeated = await run("enroll", { memberId: 1, consent: "local-face-2026-10-22", file });
      const after = await run("list");
      return { listed, noConsent, blank, repeated, after, beats };
    } finally { clearInterval(timer); worker.terminate(); }
  }, workerPath);
  assert.equal(workerResult.listed.ok, true); assert.equal(workerResult.noConsent.ok, false);
  assert.equal(workerResult.blank.ok, false);
  assert.match(workerResult.blank.error, /Tek, net/);
  assert.equal(workerResult.repeated.ok, false); assert.match(workerResult.repeated.error, /Tek, net/);
  assert.deepEqual(workerResult.after.result.members, []); assert.ok(workerResult.beats > 10);
  const modelRequests = requests.slice(before).filter(request => request.url.includes("/face-models/"));
  assert.ok(modelRequests.length >= 6);
  assert.ok(requests.slice(before).every(request => request.method === "GET" && new URL(request.url).origin === origin));
  checks.push("Real compiled Worker loads same-origin models, rejects no-consent/blank references, sends no biometric request and leaves UI responsive");

  const harness = await context.newPage();
  await harness.route(origin + "/__local_vault_test", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Isolated vault test</title>" }));
  await harness.goto(origin + "/__local_vault_test");
  const compile = file => ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const vault = await harness.evaluate(async ({ policy, vault }) => {
    const p = { exports: {} }, v = { exports: {} };
    new Function("module", "exports", policy)(p, p.exports);
    new Function("require", "module", "exports", vault)(() => p.exports, v, v.exports);
    const { readLocalReferences: read, saveLocalReference: save, clearLocalReferences: clear } = v.exports;
    const a = { groupId: "vault-a", ownerId: 99001 }, b = { groupId: "vault-b", ownerId: 99001 }, c = { groupId: "vault-a", ownerId: 99002 };
    const ref = { memberId: 77, embeddings: [Array(1024).fill(.125)], createdAt: Date.now() - 1, consent: p.exports.LOCAL_FACE_CONSENT };
    await clear(a); await clear(b); await clear(c); await save(a, ref);
    const isolated = !(await read(b)).length && !(await read(c)).length;
    const db = await new Promise(resolve => { const request = indexedDB.open("koru-local-faces-v1"); request.onsuccess = () => resolve(request.result); });
    const get = (store, action) => new Promise(resolve => { const tx = db.transaction(store, "readonly"), request = action(tx.objectStore(store)); tx.oncomplete = () => resolve(request.result); });
    const key = await get("keys", store => store.get(p.exports.localFaceScopeKey(a)));
    const rows = await get("references", store => store.getAll());
    const row = rows.find(row => row.id === p.exports.localFaceScopeKey(a) + ":77");
    const encrypted = row.data instanceof ArrayBuffer && !new TextDecoder().decode(row.data).includes('"embeddings"');
    const restored = (await read(a))[0].embeddings[0][0] === .125;
    await save(b, ref); await clear(a, 77);
    const deletedOne = !(await read(a)).length && (await read(b)).length === 1;
    const now = Date.now; let expired;
    try { Date.now = () => now() + p.exports.LOCAL_FACE_TTL + 1; expired = !(await read(b)).length; }
    finally { Date.now = now; }
    await save(b, ref);
    await new Promise(resolve => { const tx = db.transaction("references", "readwrite");
      const request = tx.objectStore("references").get(p.exports.localFaceScopeKey(b) + ":77");
      request.onsuccess = () => tx.objectStore("references").put({ ...request.result, expiresAt: request.result.expiresAt + 1000 });
      tx.oncomplete = resolve;
    });
    let rejectsTamper = false; try { await read(b); } catch { rejectsTamper = true; }
    await clear(a); await clear(b); await clear(c); db.close();
    return { isolated, encrypted, restored, deletedOne, expired, rejectsTamper, extractable: key.extractable };
  }, { policy: compile("lib/local-face-policy.ts"), vault: compile("lib/local-face-vault.ts") });
  assert.deepEqual(vault, { isolated: true, encrypted: true, restored: true, deletedOne: true, expired: true, rejectsTamper: true, extractable: false });
  await harness.close();
  checks.push("Real browser IndexedDB/AES-GCM roundtrip, nonextractable key, account/group isolation, expiry/tamper rejection and scoped deletion pass");

  assert.equal((await context.request.post(origin + "/api/auth/login", { headers: { Origin: origin }, data: { username: "demo.single", password: readGroupsDevelopmentSettings().password } })).status(), 200);
  let posts = 0, fail = false, enabled = false;
  await page.route("**/api/groups/notifications", async route => {
    if (route.request().method() === "POST") {
      posts++; await new Promise(resolve => setTimeout(resolve, 700));
      if (fail) return route.fulfill({ status: 503, json: { error: "Synthetic save failure" } });
      enabled = route.request().postDataJSON().enabled;
    }
    return route.fulfill({ json: { available: true, verified: true, enabled, deliveryReady: false, queue: { pending: 0, accepted: 0 } } });
  });
  await page.goto(origin + "/");
  await page.waitForFunction(() => Object.keys(document.querySelector(".person-picker") || {}).some(key => key.startsWith("__reactProps")));
  await page.locator(".mobile-nav").getByRole("button", { name: "Profil", exact: true }).click();
  const preference = page.getByRole("region", { name: "Buluşma e-postaları", exact: true });
  const toggle = preference.getByRole("switch"); await toggle.waitFor();
  await toggle.click(); assert.equal(await toggle.isChecked(), true); assert.equal(await toggle.isDisabled(), true);
  await preference.getByText("Tercihin kaydedildi. Gönderim hizmeti açıldığında geçerli olacak.", { exact: true }).waitFor();
  assert.equal(posts, 1); assert.equal(await preference.locator(".meeting-mail-queue").count(), 0);
  fail = true; await toggle.click(); assert.equal(await toggle.isChecked(), false);
  await preference.getByRole("alert").waitFor(); assert.equal(await toggle.isChecked(), true); assert.equal(posts, 2);
  checks.push("Mail switch updates immediately, disables duplicate saves, rolls back failures and does not show empty disabled queue");
  await page.waitForFunction(() => [...document.querySelectorAll('[role="tab"]')].some(el => Object.keys(el).some(key => key.startsWith("__reactProps"))));
  await page.getByRole("tab", { name: "Yüz verisi", exact: true }).click();
  const panel = page.getByRole("region", { name: "Yerel yüz referansları", exact: true }); await panel.waitFor();
  await panel.getByText("Yalnız bu tarayıcı", { exact: true }).waitFor();
  assert.ok(await panel.locator('input[type="file"]').first().isDisabled());
  await page.waitForTimeout(700);
  assert.equal(await panel.getByRole("alert").count(), 0, "The actual UI must open the Worker vault, not only render a label");
  for (const width of [390, 1440]) for (const scheme of ["notebook", "editorial", "catalogue", "minimal"]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(({ scheme, dark }) => { document.documentElement.dataset.scheme = scheme; document.documentElement.classList.toggle("dark", dark); }, { scheme, dark });
    await page.evaluate(() => document.fonts.ready);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `${output}/${width}-${scheme}-${dark ? "dark" : "light"}.png`, animations: "disabled", fullPage: true });
  }
  assert.deepEqual(errors, []);
  checks.push("Local reference UI requires consent and fits all four light/dark schemes on mobile/desktop under production CSP");
  status = "passed";
} catch (error) { failure = error.stack; await page.screenshot({ path: `${output}/failure-${Date.now()}.png`, fullPage: true }).catch(() => {}); writeFileSync(`${output}/failure-dom.html`, await page.content()); throw error; }
finally {
  await context.close(); await browser.close();
  writeFileSync(`${output}/${status === "passed" ? "report" : "failed-" + Date.now()}.json`, JSON.stringify({ ...sourceIdentity(), status, engine, checkedAt: new Date().toISOString(), checks, failure, errors,
    limitation: "No real faces/accounts/emails. Blank-image engine operation is not measured face accuracy or physical-phone acceptance." }, null, 2));
  console.log(JSON.stringify({ status, engine, checks: checks.length, failure }));
}
