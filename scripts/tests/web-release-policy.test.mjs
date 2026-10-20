import assert from "node:assert/strict";
import test from "node:test";
import { WEB_MANUAL_CHECKS, WEB_REQUIRED_STEPS, webReleaseFailures } from "../web-release-policy.mjs";

function fixture() {
  const now = Date.now();
  const identity = { commit: "test-revision", sourceDigest: "test-digest" };
  return { now, current: { ...identity, dirty: false },
    suite: { ...identity, dirty: false, status: "passed", platform: "web", finishedAt: new Date(now).toISOString(), steps: WEB_REQUIRED_STEPS.map((id) => ({ id, status: "passed" })) },
    audit: { ...identity, status: "passed", checkedAt: new Date(now).toISOString(), findings: [] },
    evidence: { ...identity, publicOrigin: "https://app.example.com", checks: Object.fromEntries(WEB_MANUAL_CHECKS.map((key) => [key, { status:"passed", reviewer:"Synthetic unit test", checkedAt:new Date(now).toISOString(), proofs:["synthetic-proof"] }])) },
    proofExists: () => true,
  };
}
test("web evidence fails closed when absent or for a dirty/mismatched revision", () => {
  assert.ok(webReleaseFailures({ current:{ dirty:true } }).length > 10);
  const value = fixture();
  assert.deepEqual(webReleaseFailures(value), []);
  value.current.sourceDigest = "other";
  assert.ok(webReleaseFailures(value).length >= 3);
});
test("missing PWA, iPhone, physical proof, audit or approval cannot be replaced with browser screenshots", () => {
  for (const key of WEB_MANUAL_CHECKS) {
    const value = fixture(); delete value.evidence.checks[key];
    assert.ok(webReleaseFailures(value).some((failure) => failure.endsWith(key)));
  }
  const value = fixture();
  value.suite.steps = value.suite.steps.filter((step) => step.id !== "web-pwa");
  value.audit.findings = [{ web:true, severity:"critical" }];
  value.proofExists = () => false;
  assert.ok(webReleaseFailures(value).length > 10);
});
test("stale audits, future approvals and a staging domain are rejected", () => {
  const value = fixture();
  value.audit.checkedAt = new Date(value.now - 2 * 86400_000).toISOString();
  value.evidence.checks.operatorApproval.checkedAt = new Date(value.now + 1000).toISOString();
  value.evidence.publicOrigin = "https://koru-staging.example.workers.dev";
  assert.equal(webReleaseFailures(value).length, 3);
});
test("the operator-approved free production origin does not require a paid domain", () => {
  const value = fixture();
  value.evidence.publicOrigin = "https://okuma-halkasi.mustafayapayzeka.workers.dev";
  assert.deepEqual(webReleaseFailures(value), []);
  value.evidence.publicOrigin = "https://unreviewed.example.workers.dev";
  assert.ok(webReleaseFailures(value).some((failure) => failure.includes("HTTPS")));
});
test("private/placeholder origins and inconsistent passing summaries cannot pass publication", () => {
  for (const origin of ["https://127.0.0.1", "https://10.0.0.1", "https://koru.invalid", "https://koru.test", "https://koru.local", "https://user:secret@app.example.com"]) {
    const value = fixture(); value.evidence.publicOrigin = origin;
    assert.ok(webReleaseFailures(value).some((failure) => failure.includes("HTTPS")));
  }
  const value = fixture(); value.suite.steps.push({ id:"other-test", status:"failed" });
  assert.ok(webReleaseFailures(value).some((failure) => failure.includes("web suite")));
  value.suite.steps.pop(); value.suite.dirty = true;
  assert.ok(webReleaseFailures(value).some((failure) => failure.includes("web suite")));
});
