import assert from "node:assert/strict";
import test from "node:test";
import { sharedUpdateAssessment, sharedUpdateBase } from "../shared-update-policy.mjs";
import { WEB_MANUAL_CHECKS, WEB_REQUIRED_STEPS, webReleaseFailures } from "../web-release-policy.mjs";

function fixture() {
  const now = Date.now(), identity = { commit: "reviewed-shared-update", sourceDigest: "digest" };
  const input = { current: { ...identity, dirty: false }, now, proofExists: (path) => path === "operator-proof",
    suite: { ...identity, dirty: false, status: "passed", platform: "web", finishedAt: new Date(now).toISOString(), steps: WEB_REQUIRED_STEPS.map((id) => ({ id, status: "passed" })) },
    audit: { ...identity, status: "passed", checkedAt: new Date(now).toISOString(), findings: [] },
    evidence: { ...identity, publicOrigin: "https://birkoru.com", checks: Object.fromEntries(WEB_MANUAL_CHECKS.map((key) => [key,
      key === "operatorApproval" ? { status: "passed", reviewer: "Mustafa Özgör", checkedAt: new Date(now).toISOString(), proofs: ["operator-proof"] } : { status: "pending" }])) } };
  const scope = { baseCommit: sharedUpdateBase, branch: "work/koru-web-pwa-20261019", pushedCommit: identity.commit,
    migrationDigest: "a".repeat(64), packageMatches: true, changes: [{ status: "A", path: "drizzle/0015_shared_group_storage.sql" },
      { status: "M", path: "app/api/action/route.ts" }, { status: "A", path: "scripts/shared-update-policy.mjs" }] };
  const decision = { ...identity, kind: "operator-accepted-shared-group-update", operator: "Mustafa Özgör", acceptedAt: new Date(now).toISOString(),
    baseCommit: sharedUpdateBase, migrationDigest: scope.migrationDigest, proof: "operator-proof", pendingChecks: WEB_MANUAL_CHECKS.filter((key) => key !== "operatorApproval") };
  return { input, decision, scope };
}

test("explicit shared-update acceptance records thirteen pending checks without changing the standard gate or reusing first launch", () => {
  const f = fixture(), result = sharedUpdateAssessment(f.input, f.decision, f.scope);
  assert.deepEqual(result.failures, []); assert.equal(result.standardGatePassed, false); assert.equal(result.pendingChecks.length, 13);
  assert.equal(webReleaseFailures(f.input).length, 13);
  f.decision.kind = "operator-accepted-first-public-launch";
  assert.ok(sharedUpdateAssessment(f.input, f.decision, f.scope).failures.length);
});

test("technical, audit, identity, failed evidence and missing approval failures cannot be waived", () => {
  for (const mutate of [
    (f) => { f.input.current.dirty = true; }, (f) => { f.input.suite.dirty = true; },
    (f) => { f.input.suite.steps.pop(); }, (f) => { f.input.suite.steps[0].status = "failed"; },
    (f) => { f.input.audit.findings.push({ web: true, severity: "high" }); },
    (f) => { f.input.evidence.checks.securityReview.status = "failed"; },
    (f) => { f.input.evidence.checks.operatorApproval.status = "pending"; },
    (f) => { f.input.evidence.publicOrigin = "https://staging.example.test"; },
    (f) => { f.decision.commit = "other"; }, (f) => { f.decision.sourceDigest = "other"; },
    (f) => { f.decision.migrationDigest = "b".repeat(64); }, (f) => { f.decision.proof = "missing"; },
    (f) => { f.decision.acceptedAt = new Date(f.input.now - 86400_001).toISOString(); },
    (f) => { f.decision.acceptedAt = new Date(f.input.now + 1).toISOString(); },
    (f) => { f.decision.pendingChecks.pop(); }, (f) => { f.decision.operator = "unknown"; },
  ]) {
    const f = fixture(); mutate(f); assert.ok(sharedUpdateAssessment(f.input, f.decision, f.scope).failures.length);
  }
});

test("the exception is confined to this pushed work branch, additive migration and unchanged dependency graph", () => {
  for (const mutate of [
    (f) => { f.scope.baseCommit = "other"; }, (f) => { f.scope.branch = "main"; },
    (f) => { f.scope.pushedCommit = "old"; }, (f) => { f.scope.packageMatches = false; },
    (f) => { f.scope.migrationDigest = "invalid"; }, (f) => { f.scope.changes = []; },
    (f) => { f.scope.changes[0].status = "M"; }, (f) => { f.scope.changes[1].status = "D"; },
    ...["db/accounts.ts", "pnpm-lock.yaml", "drizzle/0008_reading_groups.sql", "mobile/package.json", "../secret", "scripts/deploy-production.mjs"]
      .map((path) => (f) => { f.scope.changes.push({ status: "M", path }); }),
  ]) {
    const f = fixture(); mutate(f); assert.ok(sharedUpdateAssessment(f.input, f.decision, f.scope).failures.length);
  }
});
