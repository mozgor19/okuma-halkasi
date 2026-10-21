export const WEB_REQUIRED_STEPS = ["fixtures", "release-unit", "backend-unit", "web-types", "ui-contract", "lint", "web-build", "password-runtime", "web-production", "api", "web-ui", "branding", "legacy", "memberships", "self-service", "web-pwa", "web-experience", "web-experience-extra", "web-refinements", "web-updates"];
export const WEB_MANUAL_CHECKS = ["androidPwa", "iosPwa", "socialPreviews", "visualReview", "performanceAccessibility", "securityReview", "passwordStorage", "permanentMail", "privacyDeletion", "backupRestore", "capacityMonitoring", "productionMigrationPlan", "rollbackPlan", "operatorApproval"];

export function webReleaseFailures({ suite, audit, evidence, current, now = Date.now(), proofExists = () => false }) {
  const failures = [];
  const fresh = (value, days) => { const date = Date.parse(value); return Number.isFinite(date) && date <= now && now - date <= days * 86400_000; };
  if (current.dirty) failures.push("Commit the reviewed source before production approval; working tree is dirty.");
  for (const [label, report] of [["Suite", suite], ["Dependency audit", audit], ["Manual evidence", evidence]]) {
    if (!report || report.sourceDigest !== current.sourceDigest || report.commit !== current.commit) failures.push(`${label} does not match the current revision.`);
  }
  if (suite?.platform !== "web" || suite.status !== "passed" || suite.dirty !== false || !fresh(suite.finishedAt, 7)
    || !Array.isArray(suite.steps) || suite.steps.some((step) => step.status !== "passed") || new Set(suite.steps.map((step) => step.id)).size !== suite.steps.length) failures.push("A passing, recent web suite is required.");
  for (const id of WEB_REQUIRED_STEPS) if (!suite?.steps?.some((step) => step.id === id && step.status === "passed")) failures.push("Missing automated check: " + id);
  if (audit?.status !== "passed" || !fresh(audit.checkedAt, 1) || !Array.isArray(audit.findings)
    || audit.findings.some((item) => item.web && ["high", "critical"].includes(item.severity))) failures.push("A fresh dependency audit with no high/critical web findings is required.");
  try {
    const url = new URL(evidence?.publicOrigin);
    if (!publicHttpsOrigin(evidence.publicOrigin)
      || (url.hostname.endsWith(".workers.dev") && url.origin !== "https://okuma-halkasi.mustafayapayzeka.workers.dev")) throw new Error();
  } catch { failures.push("A reviewed production HTTPS origin is required; staging cannot be used for publication."); }
  for (const key of WEB_MANUAL_CHECKS) {
    const item = evidence?.checks?.[key];
    if (item?.status !== "passed" || typeof item.reviewer !== "string" || !item.reviewer.trim() || !fresh(item.checkedAt, 7)
      || !Array.isArray(item.proofs) || !item.proofs.length || item.proofs.some((path) => !proofExists(path))) failures.push("Missing manual evidence: " + key);
  }
  return failures;
}
import { publicHttpsOrigin } from "./release-gate.mjs";
