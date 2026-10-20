import fs from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { preflightTestProject } from "./test-project-policy.mjs";
import { assertRemoteTestState, newRemoteTestState, remoteTestService, remoteTestSummary } from "./remote-test-policy.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const base = join(root, ".sites-runtime/firebase-auth-test");
const statePath = join(base, "remote-test-state.json");
async function privateRead(path) {
  const handle = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0 || stat.size > 65536) throw Error("FIREBASE_REMOTE_TEST_PRIVATE_FILE");
    return JSON.parse(await handle.readFile("utf8"));
  } finally { await handle.close(); }
}
async function privateWrite(path, value) {
  const file = await fs.open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await file.writeFile(JSON.stringify(value, null, 2)); await file.sync(); } finally { await file.close(); }
}
async function passwordFromTerminal() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw Error("FIREBASE_REMOTE_TEST_PASSWORD_TERMINAL_REQUIRED");
  process.stdout.write("Yalniz Firebase TEST hesabinda yeni belirledigin sifreyi gir (gizli): ");
  const hidden = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const input = createInterface({ input: process.stdin, output: hidden, terminal: true, historySize: 0 });
  try {
    return await new Promise((resolve, reject) => {
      input.once("SIGINT", () => reject(Error("FIREBASE_REMOTE_TEST_PASSWORD_CANCELLED")));
      input.once("close", () => reject(Error("FIREBASE_REMOTE_TEST_PASSWORD_CANCELLED")));
      input.question("", resolve);
    });
  } finally { input.close(); hidden.end(); process.stdout.write("\n"); }
}
async function run() {
  const [action, confirmation, ...extra] = process.argv.slice(2);
  if (!["start", "verified", "finish", "cleanup", "status"].includes(action) || confirmation !== "--confirm=spark-isolated-account-test" || extra.length)
    throw Error("FIREBASE_REMOTE_TEST_EXPLICIT_APPROVAL_REQUIRED");
  for (const path of [join(root, ".sites-runtime"), base]) {
    const stat = await fs.lstat(path);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) throw Error("FIREBASE_REMOTE_TEST_PRIVATE_DIRECTORY");
  }
  const lockPath = join(base, "remote-test.lock");
  const lock = await fs.open(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  const lockStat = await lock.stat();
  let state;
  try {
    const config = await privateRead(join(base, "web-config.json"));
    if (action !== "status") await preflightTestProject(config);
    if (action === "start") {
      state = newRemoteTestState();
      await privateWrite(statePath, state);
    } else { state = await privateRead(statePath); assertRemoteTestState(state); }
    const persist = async (value) => {
      const current = await privateRead(statePath);
      if (current.runId !== state.runId) throw Error("FIREBASE_REMOTE_TEST_STATE_CHANGED");
      const temporary = join(base, ".remote-state-" + randomUUID() + ".json");
      await privateWrite(temporary, value);
      try { await fs.rename(temporary, statePath); } finally { await fs.rm(temporary, { force: true }); }
    };
    const service = remoteTestService(config, state, persist);
    if (action === "start") await service.start();
    if (action === "verified") await service.verified();
    if (action === "finish") await service.finish(await passwordFromTerminal());
    if (action === "cleanup") await service.cleanup();
    const summary = { ...remoteTestSummary(state), checkedAt: new Date().toISOString() };
    await privateWrite(join(base, "remote-report-" + randomUUID() + ".json"), summary);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    if (state) {
      try { await privateWrite(join(base, "remote-failure-" + randomUUID() + ".json"), { ...remoteTestSummary(state), checkedAt: new Date().toISOString(), status: "failed", privateDiagnosticsWithheld: true }); }
      catch { /* Preserve the private state for ownership-checked cleanup. */ }
    }
    throw error;
  } finally {
    await lock.close();
    const current = await fs.lstat(lockPath);
    if (current.ino === lockStat.ino && current.dev === lockStat.dev) await fs.unlink(lockPath);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run().catch((error) => {
  const code = /^FIREBASE_REMOTE_TEST_[A-Z_]+$/.test(error.message) ? error.message : "FIREBASE_REMOTE_TEST_STOPPED";
  console.error(code + "; no retry. Private credentials, account identifiers and provider diagnostics withheld.");
  process.exitCode = 1;
});
