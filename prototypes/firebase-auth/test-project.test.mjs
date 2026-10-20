import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { approvedTestConfig, preflightTestProject, testProject } from "./test-project-policy.mjs";

const config = () => ({ apiKey: "AIza" + "x".repeat(35), projectId: testProject.projectId, authDomain: testProject.authDomain, appId: testProject.appId });
const result = (patch = {}) => ({ projectId: testProject.projectNumber, authorizedDomains: [testProject.authDomain, testProject.projectId + ".web.app"], ...patch });
const options = (request) => ({ request, environment: {} });

test("approved test configuration accepts only the exact registered project/domain/web app and public key shape", () => {
  assert.deepEqual(approvedTestConfig(config()), config());
  assert.ok(Object.isFrozen(approvedTestConfig(config())));
  for (const patch of [{ projectId: "koru-mail" }, { projectId: "demo-koru-auth-local" }, { projectId: testProject.projectNumber },
    { authDomain: "birkoru.com" }, { appId: "1:999999999999:web:262fb6d97d63a64601fba8" }, { appId: testProject.appId + "x" },
    { apiKey: "invalid" }, { apiKey: "AIza" + "x".repeat(34) }, { measurementId: "G-NOT-USED" }, { private_key: "secret" }, { type: "service_account" }])
    assert.throws(() => approvedTestConfig({ ...config(), ...patch }), /^Error: FIREBASE_TEST_CONFIG_REJECTED$/);
  for (const value of [null, undefined, [], "private", { projectId: testProject.projectId }]) assert.throws(() => approvedTestConfig(value), /CONFIG_REJECTED/);
});
test("public preflight performs a single fixed-host GET with app-binding check and no credential/cookie/write", async () => {
  let calls = 0;
  const checked = await preflightTestProject(config(), options(async (input, init) => {
    calls++;
    const url = new URL(input);
    assert.equal(url.origin, "https://identitytoolkit.googleapis.com");
    assert.equal(url.pathname, "/v1/projects");
    assert.deepEqual([...url.searchParams.keys()].sort(), ["firebaseAppId", "key"]);
    assert.equal(url.searchParams.get("firebaseAppId"), testProject.appId);
    assert.equal(url.searchParams.get("key"), config().apiKey);
    assert.equal(init.method, "GET");
    assert.equal(init.body, undefined);
    assert.equal(init.headers.Authorization, undefined);
    assert.equal(init.credentials, "omit");
    assert.equal(init.redirect, "error");
    assert.equal(init.cache, "no-store");
    assert.ok(init.signal instanceof AbortSignal);
    return Response.json(result());
  }));
  assert.equal(calls, 1);
  assert.equal(checked.status, "passed");
  assert.equal(checked.projectId, testProject.projectId);
  for (const key of ["accountsCreated", "emailsSent", "accountImports", "cloudflareChanges"]) assert.equal(checked[key], 0);
  assert.equal(checked.billingPlan, "not-verified-by-public-api");
  assert.equal(checked.providerMethods, "not-verified-by-public-api");
});
test("public response can identify the pinned project by its known ID or known project number only", async () => {
  for (const projectId of [testProject.projectId, testProject.projectNumber]) {
    const report = await preflightTestProject(config(), options(async () => Response.json(result({ projectId }))));
    assert.equal(report.publicProjectAndAppMatch, true);
  }
  for (const projectId of ["koru-production", "999999999999", null, undefined, Number(testProject.projectNumber)])
    await assert.rejects(preflightTestProject(config(), options(async () => Response.json(result({ projectId })))), /PROJECT_MISMATCH/);
});
test("bad configuration or ambient privileged/emulator credentials are rejected before network", async () => {
  let calls = 0;
  const request = async () => { calls++; return Response.json(result()); };
  await assert.rejects(preflightTestProject({ ...config(), authDomain: "evil.invalid" }, options(request)), /CONFIG_REJECTED/);
  for (const key of ["FIREBASE_AUTH_EMULATOR_HOST", "GOOGLE_APPLICATION_CREDENTIALS", "FIREBASE_TOKEN", "CLOUDSDK_AUTH_ACCESS_TOKEN"])
    await assert.rejects(preflightTestProject(config(), { request, environment: { [key]: "synthetic-private" } }), /CREDENTIAL_ENV_REJECTED/);
  assert.equal(calls, 0);
});
test("missing expected auth domain or malformed/oversized domain lists are not connection proof", async () => {
  for (const authorizedDomains of [undefined, null, [], ["other.firebaseapp.com"], [testProject.authDomain, "https://evil.invalid"],
    [testProject.authDomain, 1], Array(101).fill(testProject.authDomain)])
    await assert.rejects(preflightTestProject(config(), options(async () => Response.json(result({ authorizedDomains })))), /PROJECT_MISMATCH/);
});
test("HTTP and transport failures expose only safe error codes, never keys/URLs/provider diagnostics", async () => {
  for (const status of [400, 401, 403, 429, 500]) await assert.rejects(preflightTestProject(config(), options(async () =>
    Response.json({ error: { message: "private provider data " + config().apiKey } }, { status }))), (error) => {
    assert.equal(error.message, "FIREBASE_TEST_PREFLIGHT_HTTP_" + status);
    assert.equal(error.cause, undefined);
    return true;
  });
  await assert.rejects(preflightTestProject(config(), options(async () => { throw Error("Private URL " + config().apiKey); })),
    (error) => error.message === "FIREBASE_TEST_PREFLIGHT_NETWORK" && error.cause === undefined);
});
test("invalid JSON, deceptive MIME and unbounded provider responses fail without write retries", async () => {
  for (const [text, mime] of [["private invalid JSON", "application/json"], [JSON.stringify(result()), "application/jsonx"],
    [JSON.stringify(result()), "text/html"], [" ".repeat(40000), "application/json"]]) {
    let calls = 0;
    await assert.rejects(preflightTestProject(config(), options(async () => {
      calls++; return new Response(text, { headers: { "Content-Type": mime } });
    })), /PREFLIGHT_RESPONSE/);
    assert.equal(calls, 1);
  }
});
test("report filters returned credentials/templates/identities and never infers billing or method settings", async () => {
  const report = await preflightTestProject(config(), options(async () => Response.json(result({
    apiKey: "private-returned-key", private_key: "private-service-account", idpConfig: [{ secret: "private-idp-secret" }],
    verifyEmailTemplate: { body: "private-email-template" }, allowPasswordUser: true, enableAnonymousUser: false,
  }))));
  assert.doesNotMatch(JSON.stringify(report), /private-|AIza|allowPasswordUser|enableAnonymousUser/);
  assert.equal(report.billingPlan, "not-verified-by-public-api");
});
test("read-only CLI rejects write/arbitrary-project options before reading config or using network", () => {
  for (const args of [["--apply"], ["--project=koru-production"], ["--create-account"], ["--config=../../private"]]) {
    const result = spawnSync(process.execPath, [new URL("./preflight-test-project.mjs", import.meta.url).pathname, ...args], { encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /FIREBASE_TEST_PREFLIGHT_NO_ARGUMENTS/);
    assert.doesNotMatch(result.stderr, /AIza|PRIVATE KEY|AssertionError/);
  }
});
