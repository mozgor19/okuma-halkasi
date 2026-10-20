import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { approvedProductionFirebaseConfig, preflightProductionFirebase, productionFirebase } from "../firebase-production-policy.mjs";

const config = { apiKey: "AIza" + "x".repeat(35), projectId: productionFirebase.projectId, authDomain: productionFirebase.authDomain, appId: productionFirebase.appId };
const data = { projectId: productionFirebase.projectNumber, authorizedDomains: [productionFirebase.authDomain, "birkoru.com"] };
const response = (value = data, options = {}) => Response.json(value, options);

test("production Firebase configuration pins the operator's separate project/app and rejects test or privileged inputs", () => {
  assert.deepEqual(approvedProductionFirebaseConfig(config), config);
  for (const input of [null, [], {}, { ...config, projectId: "koru-auth-test" }, { ...config, authDomain: "evil.example" },
    { ...config, appId: "1:605673770248:web:other" }, { ...config, apiKey: "invalid" }, { ...config, private_key: "synthetic" },
    { ...config, storageBucket: "not-needed" }]) assert.throws(() => approvedProductionFirebaseConfig(input), /CONFIG_REJECTED/);
});

test("production preflight makes only one bounded, fixed Google GET and exposes no web key or provider diagnostics", async () => {
  let calls = 0;
  const report = await preflightProductionFirebase(config, { environment: {}, request: async (input, options) => {
    calls++;
    const url = new URL(input);
    assert.equal(url.origin, "https://identitytoolkit.googleapis.com"); assert.equal(url.pathname, "/v1/projects");
    assert.equal(url.searchParams.get("key"), config.apiKey); assert.equal(url.searchParams.get("firebaseAppId"), config.appId);
    assert.equal(options.method, "GET"); assert.equal(options.redirect, "error"); assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "omit"); assert.equal(options.body, undefined); assert.ok(options.signal);
    return response();
  } });
  assert.equal(calls, 1); assert.equal(report.status, "passed"); assert.equal(report.applicationDomainPresent, true);
  for (const key of ["accountsCreated", "emailsSent", "accountImports", "cloudflareChanges"]) assert.equal(report[key], 0);
  assert.ok(!JSON.stringify(report).includes(config.apiKey)); assert.equal(report.billingPlan, "not-verified-by-public-api");
});

test("an absent production domain is a configuration requirement, never a false pass", async () => {
  const report = await preflightProductionFirebase(config, { environment: {}, request: async () => response({ ...data, authorizedDomains: [productionFirebase.authDomain] }) });
  assert.equal(report.status, "configuration-required"); assert.equal(report.applicationDomainPresent, false);
});

test("unknown projects, foreign/default domains, oversized or malformed domain lists cannot satisfy production preflight", async () => {
  for (const value of [null, { ...data, projectId: "koru-auth-test" }, { ...data, authorizedDomains: ["birkoru.com"] },
    { ...data, authorizedDomains: "birkoru.com" }, { ...data, authorizedDomains: [productionFirebase.authDomain, "evil/path"] },
    { ...data, authorizedDomains: Array(101).fill(productionFirebase.authDomain) }]) {
    await assert.rejects(preflightProductionFirebase(config, { environment: {}, request: async () => response(value) }), /PROJECT_MISMATCH/);
  }
});

test("emulator and privileged credential environments are rejected before networking", async () => {
  for (const key of ["FIREBASE_AUTH_EMULATOR_HOST", "GOOGLE_APPLICATION_CREDENTIALS", "FIREBASE_TOKEN", "CLOUDSDK_AUTH_ACCESS_TOKEN"]) {
    await assert.rejects(preflightProductionFirebase(config, { environment: { [key]: "synthetic" }, request: () => assert.fail("No request permitted") }), /CREDENTIAL_ENV_REJECTED/);
  }
});

test("provider errors, HTML, malformed JSON, oversized bodies and redirects never disclose provider response text", async () => {
  const diagnostic = "synthetic-private-diagnostic";
  const requests = [
    async () => { throw Error(diagnostic); },
    async () => response({ diagnostic }, { status: 403 }),
    async () => new Response(diagnostic, { headers: { "Content-Type": "text/html" } }),
    async () => new Response("{", { headers: { "Content-Type": "application/json" } }),
    async () => response({ diagnostic: "x".repeat(33_000) }),
    async () => { const result = response(); Object.defineProperty(result, "redirected", { value: true }); return result; },
  ];
  for (const request of requests) await assert.rejects(preflightProductionFirebase(config, { environment: {}, request }), (error) => {
    assert.match(error.message, /^FIREBASE_PRODUCTION_/); assert.ok(!error.message.includes(diagnostic)); return true;
  });
});

test("operator preflight refuses arbitrary files, origins and write flags before reading configuration or making requests", () => {
  for (const argument of ["--deploy", "--config=/tmp/foreign.json", "https://evil.example"]) {
    const result = spawnSync(process.execPath, ["scripts/firebase-production-preflight.mjs", argument], { encoding: "utf8" });
    assert.equal(result.status, 1); assert.match(result.stderr, /FIREBASE_PRODUCTION_PREFLIGHT_NO_ARGUMENTS/);
  }
});
