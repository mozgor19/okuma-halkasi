import assert from "node:assert/strict";
import test from "node:test";
import { firstPublicLaunchAssessment } from "../first-public-launch-policy.mjs";
import { WEB_REQUIRED_STEPS, WEB_MANUAL_CHECKS, webReleaseFailures } from "../web-release-policy.mjs";
function fixture() {
  const now = Date.now(), identity = { commit: "reviewed", sourceDigest: "digest" };
  const input = { current: { ...identity, dirty: false }, now, proofExists: (path) => path === "operator-proof",
    suite: { ...identity, dirty: false, status: "passed", platform: "web", finishedAt: new Date(now).toISOString(), steps: WEB_REQUIRED_STEPS.map((id) => ({ id, status: "passed" })) },
    audit: { ...identity, status: "passed", checkedAt: new Date(now).toISOString(), findings: [] },
    evidence: { ...identity, publicOrigin: "https://birkoru.com", checks: Object.fromEntries(WEB_MANUAL_CHECKS.map((key) => [key,
      key === "operatorApproval" ? { status: "passed", reviewer: "Mustafa Özgör", checkedAt: new Date(now).toISOString(), proofs: ["operator-proof"] } : { status: "pending" }])) } };
  return { input, decision: { ...identity, kind: "operator-accepted-first-public-launch", operator: "Mustafa Özgör", acceptedAt: new Date(now).toISOString(),
    proof: "operator-proof", pendingChecks: WEB_MANUAL_CHECKS.filter((key) => key !== "operatorApproval") } };
}
test("an acknowledged first launch remains distinct from a passed standard release", () => {
  const { input, decision } = fixture();
  const result = firstPublicLaunchAssessment(input, decision);
  assert.deepEqual(result.failures, []);
  assert.equal(result.standardGatePassed, false);
  assert.equal(result.pendingChecks.length, 13);
  assert.equal(webReleaseFailures(input).length, 13);
});
test("no technical failure, failed evidence or absent approval can be waived", () => {
  for (const mutate of [
    (i) => { i.current.dirty = true; }, (i) => { i.audit.status = "blocked"; },
    (i) => { i.suite.steps.pop(); }, (i) => { i.evidence.checks.androidPwa.status = "failed"; },
    (i) => { i.evidence.checks.operatorApproval.status = "pending"; },
    (i, d) => { d.commit = "other"; }, (i, d) => { d.proof = "missing"; },
    (i, d) => { d.acceptedAt = new Date(i.now - 86400_001).toISOString(); },
  ]) {
    const { input, decision } = fixture(); mutate(input, decision);
    assert.ok(firstPublicLaunchAssessment(input, decision).failures.length);
  }
});
