import { constants } from "node:fs";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { preflightProductionFirebase } from "./firebase-production-policy.mjs";

try {
  if (process.argv.length !== 2) throw Error("FIREBASE_PRODUCTION_PREFLIGHT_NO_ARGUMENTS");
  const base = resolve(".sites-runtime/koru-production");
  for (const directory of [resolve(".sites-runtime"), base]) {
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) throw Error("FIREBASE_PRODUCTION_PRIVATE_DIRECTORY");
  }
  const file = await fs.open(resolve(base, "firebase-web-config.json"), constants.O_RDONLY | constants.O_NOFOLLOW);
  let config;
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0 || stat.size > 4096) throw Error("FIREBASE_PRODUCTION_PRIVATE_CONFIG");
    config = JSON.parse(await file.readFile("utf8"));
  } finally { await file.close(); }
  const report = { ...await preflightProductionFirebase(config), checkedAt: new Date().toISOString() };
  const path = resolve(base, "firebase-preflight-" + randomUUID() + ".json");
  const output = await fs.open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await output.writeFile(JSON.stringify(report, null, 2)); await output.sync(); } finally { await output.close(); }
  console.log(JSON.stringify({ ...report, report: path.slice(process.cwd().length + 1) }, null, 2));
  if (report.status !== "passed") process.exitCode = 2;
} catch (error) {
  const code = /^FIREBASE_PRODUCTION_[A-Z_]+(?:_\d+)?$/.test(error.message) ? error.message : "FIREBASE_PRODUCTION_PREFLIGHT_FAILED";
  console.error(code + "; configuration and provider diagnostics withheld; no account writes."); process.exitCode = 1;
}
