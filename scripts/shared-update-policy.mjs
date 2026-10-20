import { WEB_MANUAL_CHECKS, webReleaseFailures } from "./web-release-policy.mjs";
import { production } from "./web-production-policy.mjs";

export const sharedUpdateBase = "1c39e4d1d52b9b124560daf15348fb443edfa6de";
const allowedPaths = new Set([
  "AGENTS.md", "app/api/action/route.ts", "app/api/calendar/[meetingId]/route.ts", "app/api/media/[key]/route.ts",
  "app/api/operations/erasure/route.ts", "app/api/upload/route.ts", "cloudflare-env.d.ts",
  "db/account-erasure.ts", "db/database.ts", "db/domain-sql.ts", "db/onboarding-groups.ts", "db/schema.ts", "db/store.ts",
  "docs/ARCHITECTURE_CURRENT.md", "docs/FIREBASE_PRODUCTION.md", "docs/SESSION_MEMORY.md", "docs/SHARED_GROUP_STORAGE.md",
  "docs/WEB_RELEASE.md", "drizzle/0015_shared_group_storage.sql", "lib/groups.ts", "package.json",
  "scripts/deploy-shared-groups.mjs", "scripts/backup-production-d1.mjs", "scripts/d1-backup-policy.mjs", "scripts/tests/d1-backup.test.mjs",
  "scripts/fixtures/firebase-account-test.mjs", "scripts/fixtures/shared-groups-test.mjs",
  "scripts/production-deploy-policy.mjs", "scripts/shared-group-migration-policy.mjs", "scripts/shared-update-policy.mjs",
  "scripts/shared-update-source.mjs", "scripts/tests/firebase-worker.test.mjs", "scripts/tests/production-deploy.test.mjs",
  "scripts/tests/shared-groups-worker.test.mjs", "scripts/tests/shared-groups.test.mjs", "scripts/tests/shared-update-policy.test.mjs",
  "scripts/web-production-policy.mjs", "scripts/web-production-preflight.mjs",
  ...["groups.png", "groups.svg", "index.html", "koru-architecture.pdf", "lifecycle.png", "lifecycle.svg",
    "live-login-desktop-light.png", "live-login-mobile-dark.png", "system.png", "system.svg"].map((name) => "docs/architecture/" + name),
]);

// One explicitly approved update, not a general waiver or first-launch replay.
export function sharedUpdateAssessment(input, decision, scope) {
  const all = webReleaseFailures(input);
  const pending = WEB_MANUAL_CHECKS.filter((key) => all.includes("Missing manual evidence: " + key));
  const failures = all.filter((item) => !pending.some((key) => item === "Missing manual evidence: " + key));
  const now = input.now ?? Date.now(), accepted = Date.parse(decision?.acceptedAt);
  if (input.evidence?.publicOrigin !== production.origin || decision?.kind !== "operator-accepted-shared-group-update"
    || decision?.operator !== "Mustafa Özgör" || decision?.commit !== input.current.commit || decision?.sourceDigest !== input.current.sourceDigest
    || decision?.baseCommit !== sharedUpdateBase || decision?.migrationDigest !== scope?.migrationDigest
    || !Number.isFinite(accepted) || accepted > now || now - accepted > 86400_000
    || !Array.isArray(decision?.pendingChecks) || new Set(decision.pendingChecks).size !== decision.pendingChecks.length
    || decision.pendingChecks.length !== pending.length || pending.some((key) => !decision.pendingChecks.includes(key))
    || pending.includes("operatorApproval") || pending.some((key) => input.evidence?.checks?.[key]?.status !== "pending")
    || !input.proofExists?.(decision.proof)) failures.push("Explicit revision-bound shared-group update risk acceptance is absent or inconsistent.");
  if (!scope || scope.baseCommit !== sharedUpdateBase || scope.branch !== "work/koru-web-pwa-20261019"
    || scope.pushedCommit !== input.current.commit || scope.packageMatches !== true || !/^[a-f0-9]{64}$/.test(scope.migrationDigest ?? "")
    || !Array.isArray(scope.changes) || !scope.changes.length
    || scope.changes.some((change) => !change || !["A", "M"].includes(change.status) || !allowedPaths.has(change.path))
    || !scope.changes?.some((change) => change.path === "drizzle/0015_shared_group_storage.sql" && change.status === "A")) {
    failures.push("Shared-group update source scope, branch, pushed revision or dependency boundary requires review.");
  }
  return { mode: "shared-group-update-exception", standardGatePassed: all.length === 0, pendingChecks: pending, failures };
}
