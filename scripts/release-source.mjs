import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export function sourceIdentity() {
  const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
  const files = git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean).sort();
  const hash = createHash("sha256");
  for (const path of [...new Set(files)]) {
    hash.update(path + "\0");
    try { hash.update(readFileSync(path)); } catch (error) { if (error.code !== "ENOENT") throw error; hash.update("<deleted>"); }
    hash.update("\0");
  }
  return { commit: git("rev-parse", "HEAD"), sourceDigest: hash.digest("hex"), dirty: Boolean(git("status", "--porcelain")) };
}
