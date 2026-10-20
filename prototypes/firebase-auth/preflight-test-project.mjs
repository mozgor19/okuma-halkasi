import fs from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { preflightTestProject } from "./test-project-policy.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const base = join(root, ".sites-runtime/firebase-auth-test");
async function checkDirectory(path) {
  const stat = await fs.lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) throw Error("FIREBASE_TEST_PRIVATE_DIRECTORY");
}
async function run() {
  if (process.argv.length !== 2) throw Error("FIREBASE_TEST_PREFLIGHT_NO_ARGUMENTS");
  await checkDirectory(join(root, ".sites-runtime"));
  await checkDirectory(base);
  const file = await fs.open(join(base, "web-config.json"), constants.O_RDONLY | constants.O_NOFOLLOW);
  let config;
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0 || stat.size > 4096) throw Error("FIREBASE_TEST_PRIVATE_CONFIG");
    config = JSON.parse(await file.readFile("utf8"));
  } finally { await file.close(); }
  const report = { ...await preflightTestProject(config), checkedAt: new Date().toISOString() };
  const path = join(base, "preflight-" + randomUUID() + ".json");
  const output = await fs.open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await output.writeFile(JSON.stringify(report, null, 2)); await output.sync(); } finally { await output.close(); }
  console.log(JSON.stringify({ ...report, report: path.slice(root.length) }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run().catch((error) => {
  const code = /^FIREBASE_TEST_[A-Z_]+(?:_\d+)?$/.test(error.message) ? error.message : "FIREBASE_TEST_PREFLIGHT_FAILED";
  console.error(code + "; configuration and provider diagnostics withheld; no account writes.");
  process.exitCode = 1;
});
