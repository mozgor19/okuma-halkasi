import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { KORU_BRAND, brandPublicOrigin } from "../../lib/brand-identity.ts";
import { browserSecurityHeaders } from "../../lib/web-security.ts";

test("brand origins fail closed; no credentials, paths or insecure origins in public previews", () => {
  assert.equal(brandPublicOrigin("https://koru.example/"), "https://koru.example");
  for (const value of [null, "", "http://koru.example", "https://user:secret@koru.example", "https://koru.example/private", "https://koru.example/?invite=secret", "https://koru.example/#secret"]) assert.equal(brandPublicOrigin(value), null);
});

test("stable Koru manifest and raster assets never contain group or account data", () => {
  const manifest = JSON.parse(readFileSync("public/koru.webmanifest", "utf8"));
  assert.equal(manifest.name, KORU_BRAND.name);
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.display, "standalone");
  for (const [name, width, height] of [["koru-apple-180",180,180],["koru-192",192,192],["koru-512",512,512],["koru-maskable-512",512,512],["koru-share-v1",1200,630],["koru-badge-96",96,96]]) {
    const png = readFileSync(`public/brand/${name}.png`);
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), height);
  }
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
  const css = readFileSync("app/themes.css", "utf8");
  assert.ok(!css.includes("fonts.googleapis.com"));
  for (const family of ["bricolagegrotesque", "literata"]) assert.ok(readFileSync(`public/fonts/${family}-OFL.txt`, "utf8").includes("SIL OPEN FONT LICENSE"));
  for (const file of ["bricolage-latin","bricolage-latin-ext","literata-latin","literata-latin-ext","literata-italic-latin","literata-italic-latin-ext"]) assert.equal(readFileSync(`public/fonts/${file}.woff2`).toString("ascii",0,4), "wOF2");
});

test("security headers protect login as well as enabled onboarding without claiming a strict script CSP", () => {
  for (const enabled of [false, true]) {
    const headers = browserSecurityHeaders(enabled);
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.equal(headers["Referrer-Policy"], "no-referrer");
    assert.ok(headers["Content-Security-Policy"].includes("frame-ancestors 'none'"));
    assert.ok(headers["Content-Security-Policy"].includes("object-src 'none'"));
    assert.equal(headers["Content-Security-Policy"].includes("https://challenges.cloudflare.com"), enabled);
  }
});

function worker({ shellUrl = "https://koru.example/offline", shellType = "text/html", shellStatus = 200 } = {}) {
  const handlers = {};
  const added = [], downloaded = [], deleted = [], opened = [];
  const shell = new Response("generic offline");
  const self = { location: { origin: "https://koru.example" }, addEventListener: (key, fn) => { handlers[key] = fn; }, clients: { claim: async () => {}, matchAll: async () => [], openWindow: async (url) => opened.push(url) } };
  const cache = { put: async (path, response) => added.push({ url: new URL(path,self.location.origin).href, response }) };
  class LocalRequest extends Request { constructor(url, options) { super(new URL(url, self.location.origin), options); } }
  runInNewContext(readFileSync("public/koru-sw.js", "utf8"), { self, URL, Request: LocalRequest, Response,
    caches: { open: async () => cache, keys: async () => ["koru-public-shell-v0", "unrelated-cache"], delete: async (key) => deleted.push(key), match: async (url) => { assert.equal(url, "/offline.html"); return shell; } },
    fetch: async (request) => {
      if (request.url === "https://koru.example/offline.html") {
        downloaded.push({ url:request.url,credentials:request.credentials });
        const response = new Response("generic offline",{ status:shellStatus,headers:{ "Content-Type":shellType } });
        Object.defineProperty(response,"url",{ value:shellUrl });
        Object.defineProperty(response,"redirected",{ value:true });
        return response;
      }
      throw new Error("offline");
    } });
  return { handlers, added, downloaded, deleted, opened, shell };
}

test("offline worker stores only anonymous shell; leaves APIs, writes and foreign resources untouched", async () => {
  const { handlers, added, downloaded, deleted, shell } = worker();
  let pending;
  const waitUntil = (promise) => { pending = promise; };
  handlers.install({ waitUntil }); await pending;
  assert.deepEqual(downloaded, [{ url: "https://koru.example/offline.html", credentials: "omit" }]);
  assert.equal(added.length,1);
  assert.equal(added[0].url,"https://koru.example/offline.html");
  assert.equal(added[0].response.redirected,false);
  assert.equal(added[0].response.url,"");
  assert.equal(await added[0].response.text(),"generic offline");
  handlers.activate({ waitUntil }); await pending;
  assert.deepEqual(deleted, ["koru-public-shell-v0"]);
  for (const request of [{ method:"POST", mode:"navigate", url:"https://koru.example/" }, { method:"GET", mode:"cors", url:"https://koru.example/api/state" }, { method:"GET", mode:"cors", url:"https://koru.example/api/media/private" }, { method:"GET", mode:"navigate", url:"https://koru.example/api/calendar/1" }, { method:"GET", mode:"navigate", url:"https://other.example/" }]) {
    handlers.fetch({ request, respondWith() { assert.fail("Sensitive/non-navigation request must not be intercepted"); } });
  }
  handlers.fetch({ request: { method:"GET", mode:"navigate", url:"https://koru.example/?group=private" }, respondWith(promise) { pending = promise; } });
  assert.equal(await pending, shell);
});

test("offline installation cannot cache a login redirect, foreign page, failed response or wrong MIME type", async () => {
  for (const options of [{ shellUrl:"https://koru.example/login" },{ shellUrl:"https://evil.example/offline" },{ shellType:"application/json" },{ shellStatus:503 }]) {
    const { handlers, added } = worker(options);
    let pending; handlers.install({ waitUntil(promise) { pending=promise; } });
    await assert.rejects(pending,/Public offline shell unavailable/);
    assert.deepEqual(added,[]);
  }
});

test("notification destinations cannot open foreign sites, scripts, credentials or API URLs", async () => {
  for (const url of ["https://evil.example/", "javascript:alert(1)", "https://user:secret@koru.example/", "/api/onboarding/account", "http://[", "/?group=second&meeting=1"]) {
    const { handlers, opened } = worker();
    let pending;
    handlers.notificationclick({ notification: { data: { url }, close() {} }, waitUntil(promise) { pending = promise; } });
    await pending;
    assert.deepEqual(opened, [url.startsWith("/?") ? "https://koru.example" + url : "https://koru.example/"]);
  }
});
