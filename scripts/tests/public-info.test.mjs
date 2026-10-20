import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { infoSite, renderInfoPages } from "../../public-info/site.mjs";
import worker, { infoSecurityHeaders } from "../../public-info/worker.mjs";
import { assertInfoConfig, infoAssets } from "../build-public-info.mjs";
import { assertPublicInfoBindings } from "../public-info-policy.mjs";
import { KORU_BRAND, KORU_MARK_PATHS } from "../../lib/brand-identity.ts";

test("public pages identify the operator, closed-test scope and actual Gmail send-only use", () => {
  const pages = renderInfoPages();
  for (const path of ["/", "/privacy", "/terms"]) {
    const html = pages.get(path);
    assert.ok(html.includes('<html lang="tr">'));
    assert.ok(html.includes(`href="${infoSite.origin + path}"`));
    assert.ok(html.includes('href="/privacy"') && html.includes('href="/terms"'));
    assert.ok(html.includes("Genel kayıt henüz açılmadı"));
    assert.ok(html.includes("Mustafa Özgör") && html.includes(infoSite.support));
    for (const geometry of KORU_MARK_PATHS) assert.ok(html.includes(`d="${geometry}"`));
    for (const asset of [KORU_BRAND.icon, KORU_BRAND.appleIcon, KORU_BRAND.socialImage]) assert.ok(html.includes(asset));
    assert.doesNotMatch(html, /M14 12v40|koru-share-v1/);
    assert.doesNotMatch(html, /<form\b|<iframe\b|unsafe-inline|refreshToken|clientSecret/);
  }
  const privacy = pages.get("/privacy");
  assert.match(privacy, /gmail\.send/);
  assert.match(privacy, /Gmail kutularını okumaz/);
  assert.match(privacy, /anında silmez/);
  assert.match(privacy, /Limited Use/);
  assert.match(privacy, /Türkiye dışında/);
  assert.match(pages.get("/"), /yalnız örnek veriler/);
});

test("Search Console verification is optional, public metadata, strictly bounded and escaped", () => {
  assert.doesNotMatch(renderInfoPages().get("/"), /google-site-verification/);
  const verification = "Synthetic_Verification_Value_12345";
  assert.match(renderInfoPages(verification).get("/"), new RegExp(`name="google-site-verification" content="${verification}"`));
  for (const bad of [undefined, "", "<script>alert(1)</script>", "a".repeat(257), '" onload="bad']) assert.throws(() => renderInfoPages(bad === undefined ? 3 : bad));
});

test("public worker is read-only, strips cookies/query and never proxies account APIs", async () => {
  const calls = [];
  const env = { ASSETS: { async fetch(request) { calls.push(request); return new Response("public page", { headers: { "Content-Type": "text/html", "Set-Cookie": "should-not-survive=1" } }); } } };
  const response = await worker.fetch(new Request(infoSite.origin + "/privacy?invite=private", { headers: { Cookie: "session=private", Authorization: "Bearer private" } }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
  for (const [key, value] of Object.entries(infoSecurityHeaders)) assert.equal(response.headers.get(key), value);
  assert.equal(calls[0].url, infoSite.origin + "/privacy");
  assert.equal(calls[0].headers.get("cookie"), null);
  assert.equal(calls[0].headers.get("authorization"), null);
  for (const path of ["/api/state", "/api/onboarding/register", "/login", "/register", "/groups"]) assert.equal((await worker.fetch(new Request(infoSite.origin + path), env)).status, 404);
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) assert.equal((await worker.fetch(new Request(infoSite.origin, { method }), env)).status, 405);
  assert.equal(calls.length, 1);
  assert.equal(await (await worker.fetch(new Request(infoSite.origin, { method: "HEAD" }), env)).text(), "");
});

test("public-only configuration cannot deploy the app, bind storage/secrets or open signup", () => {
  const config = { name: infoSite.worker, account_id: infoSite.accountId, main: resolve("public-info/worker.mjs"), compatibility_date: "2026-05-15", workers_dev: true, preview_urls: false,
    assets: { directory: infoAssets, binding: "ASSETS", run_worker_first: true, not_found_handling: "404-page" }, vars: { KORU_PUBLIC_INFO_ONLY: "true" }, observability: { enabled: false } };
  assert.doesNotThrow(() => assertInfoConfig(config));
  for (const change of [{ name: "okuma-halkasi" }, { d1_databases: [] }, { services: [] }, { routes: [] }, { vars: { SELF_SERVICE_ENABLED: "true" } }, { account_id: "other" }, { main: resolve("dist/server/index.js") }, { assets: { ...config.assets, directory: resolve("public") } }]) assert.throws(() => assertInfoConfig({ ...config, ...change }));
});

test("an unknown existing Worker or extra runtime capability cannot be adopted as the public site", () => {
  const bindings = [{ name: "ASSETS", type: "assets" }, { name: "KORU_PUBLIC_INFO_ONLY", type: "plain_text", text: "true" }];
  assert.doesNotThrow(() => assertPublicInfoBindings(bindings));
  for (const extra of [{ name: "DB", type: "d1" }, { name: "SESSION_SECRET", type: "secret_text" }, { name: "APP", type: "service" }]) assert.throws(() => assertPublicInfoBindings([...bindings, extra]));
  for (const wrong of [undefined, [], bindings.slice(1), [{ name: "ASSETS", type: "assets" }, { name: "KORU_PUBLIC_INFO_ONLY", type: "plain_text", text: "false" }]]) assert.throws(() => assertPublicInfoBindings(wrong));
});
