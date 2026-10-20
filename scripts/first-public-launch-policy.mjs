import { WEB_MANUAL_CHECKS, webReleaseFailures } from "./web-release-policy.mjs";
import { production } from "./web-production-policy.mjs";

// Separate from the standard gate: an explicit first-launch risk decision is
// recorded as an exception, never converted into passing device/mail evidence.
export function firstPublicLaunchAssessment(input, decision) {
  const all = webReleaseFailures(input);
  const pending = WEB_MANUAL_CHECKS.filter((key) => all.includes("Missing manual evidence: " + key));
  const failures = all.filter((item) => !pending.some((key) => item === "Missing manual evidence: " + key));
  const now = input.now ?? Date.now();
  const accepted = Date.parse(decision?.acceptedAt);
  if (input.evidence?.publicOrigin !== production.origin || decision?.kind !== "operator-accepted-first-public-launch"
    || decision?.commit !== input.current.commit || decision?.sourceDigest !== input.current.sourceDigest
    || decision?.operator !== "Mustafa Özgör" || !Number.isFinite(accepted) || accepted > now || now - accepted > 86400_000
    || !Array.isArray(decision?.pendingChecks) || new Set(decision.pendingChecks).size !== decision.pendingChecks.length
    || decision.pendingChecks.length !== pending.length || pending.some((key) => !decision.pendingChecks.includes(key))
    || pending.includes("operatorApproval") || pending.some((key) => input.evidence?.checks?.[key]?.status !== "pending")
    || !input.proofExists?.(decision.proof)) failures.push("Explicit revision-bound first-public-launch risk acceptance is absent or inconsistent.");
  return { mode: "first-public-launch-exception", standardGatePassed: all.length === 0, pendingChecks: pending, failures };
}
