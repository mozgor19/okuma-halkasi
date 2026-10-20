import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { sharedUpdateBase } from "./shared-update-policy.mjs";
import { sharedGroupMigrationPlan } from "./shared-group-migration-policy.mjs";

export function sharedUpdateSourceScope() {
  const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trimEnd();
  const base = JSON.parse(git("show", sharedUpdateBase + ":package.json"));
  const expected = { ...base, scripts: { ...base.scripts, "web:groups:deploy": "node scripts/deploy-shared-groups.mjs" } };
  const changes = git("diff", "--name-status", "--no-renames", "-z", sharedUpdateBase, "HEAD").split("\0").filter(Boolean);
  if (changes.length % 2) throw Error("SHARED_UPDATE_DIFF_INVALID");
  return { baseCommit: sharedUpdateBase, branch: git("branch", "--show-current"),
    pushedCommit: git("rev-parse", "refs/remotes/origin/work/koru-web-pwa-20261019"),
    packageMatches: isDeepStrictEqual(expected, JSON.parse(readFileSync("package.json", "utf8"))),
    changes: Array.from({ length: changes.length / 2 }, (_, i) => ({ status: changes[i * 2], path: changes[i * 2 + 1] })),
    migrationDigest: sharedGroupMigrationPlan().digest };
}
