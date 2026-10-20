import assert from "node:assert/strict";
import test from "node:test";
import { assertOwnedProbe, assertProbeConfiguration, probeConfiguration } from "../probe-password-cloudflare.mjs";
import worker from "../fixtures/password-runtime-probe.worker.mjs";

const runId = "11111111-1111-4111-8111-111111111111";
test("remote password measurement can target only the isolated no-capability Worker", () => {
  const config = probeConfiguration(runId);
  assert.doesNotThrow(() => assertProbeConfiguration(config, runId));
  for (const change of [{ name: "okuma-halkasi" }, { name: "koru-staging" }, { account_id: "other" }, { routes: [] }, { d1_databases: [] }, { services: [] }, { assets: {} }, { vars: { SESSION_SECRET: "not-allowed" } }, { observability: { enabled: true } }]) {
    assert.throws(() => assertProbeConfiguration({ ...config, ...change }, runId));
  }
});
test("cleanup requires this exact run marker and unchanged deployment", () => {
  const settings = { bindings: [{ name: "KORU_PASSWORD_PROBE_RUN", type: "plain_text", text: runId }] };
  assert.doesNotThrow(() => assertOwnedProbe(settings, runId, "deployment-one", "deployment-one"));
  for (const value of [{ bindings: [] }, { bindings: [...settings.bindings, { name: "DB", type: "d1" }] }, { bindings: [{ ...settings.bindings[0], text: "other-run" }] }]) assert.throws(() => assertOwnedProbe(value, runId, "deployment-one", "deployment-one"));
  assert.throws(() => assertOwnedProbe(settings, runId, "deployment-one", "deployment-two"));
  assert.throws(() => assertOwnedProbe(settings, runId, undefined, undefined));
});
test("probe readiness identifies this deployment; arbitrary inputs cannot add cryptographic work", async () => {
  const env = { KORU_PASSWORD_PROBE_RUN: runId };
  const ready = await worker.fetch(new Request("https://probe.invalid/ready"), env);
  assert.equal(ready.headers.get("cache-control"), "no-store");
  assert.deepEqual(await ready.json(), { probe: "koru-password-probe-v1", runId });
  for (const path of ["/", "/999999999", "/100000?password=private", "/0x186A0", "/0100000"]) assert.equal((await worker.fetch(new Request("https://probe.invalid" + path), env)).status, 404);
  assert.equal((await worker.fetch(new Request("https://probe.invalid/600000", { method: "POST", body: "private" }), env)).status, 404);
});
