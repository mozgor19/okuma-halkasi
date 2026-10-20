import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.argv.slice(2).some((value) => value !== "--test") || process.argv.length > 3) throw Error("Only local dev or --test is supported.");
const testing = process.argv.includes("--test");
const root = fileURLToPath(new URL("../", import.meta.url));
const runId = "firebase-local-" + crypto.randomUUID();
const folder = path.join(root, ".sites-runtime/release-tests", runId);
await fs.mkdir(folder, { recursive: true, mode: 0o700 });
await fs.mkdir(path.join(folder, "home"), { recursive: true, mode: 0o700 });
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(GOOGLE|GCLOUD|GCP|FIREBASE|CLOUDSDK|KORU_FIREBASE|OKUMA_|CLOUDFLARE_|CF_API_|GMAIL_|RESEND_|TURNSTILE_|SESSION_SECRET$|MEMBER_CREDENTIALS$)/.test(key)));
Object.assign(environment, { HOME: path.join(folder, "home"), XDG_CONFIG_HOME: path.join(folder, "home/.config"),
  PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.HOME, ".cache/ms-playwright"),
  CI: "true", FIREBASE_CLI_DISABLE_UPDATE_CHECK: "true", FIREBASE_CLI_DISABLE_TELEMETRY: "true",
  WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", CLOUDFLARE_CF_FETCH_ENABLED: "false",
  OKUMA_TEST_RUN_ID: runId, OKUMA_GROUPS_DEVELOPMENT: "1", OKUMA_SELF_SERVICE_DEVELOPMENT: "1", OKUMA_FIREBASE_LOCAL: "1",
  OKUMA_APPLICATION_BRAND: "Koru" });
const used = new Set();
async function port() {
  while (true) {
    const server = net.createServer();
    await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
    const value = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    if (!used.has(value)) { used.add(value); return value; }
  }
}
const [authPort, hubPort, loggingPort, webPort] = [await port(), await port(), await port(), await port()];
Object.assign(environment, { OKUMA_TEST_ORIGIN: `http://127.0.0.1:${webPort}`, OKUMA_FIREBASE_EMULATOR_ORIGIN: `http://127.0.0.1:${authPort}` });
const firebaseConfig = path.join(folder, "firebase.json");
await fs.writeFile(firebaseConfig, JSON.stringify({ emulators: { auth: { host: "127.0.0.1", port: authPort },
  hub: { host: "127.0.0.1", port: hubPort }, logging: { host: "127.0.0.1", port: loggingPort }, ui: { enabled: false }, singleProjectMode: true } }), { mode: 0o600 });
const children = [], logs = [];
async function launch(args, name, cwd = root, ipc = false) {
  const log = await fs.open(path.join(folder, name + ".log"), "wx", 0o600); logs.push(log);
  const child = spawn(process.execPath, args, { cwd, env: environment, stdio: ["ignore", log.fd, log.fd, ...(ipc ? ["ipc"] : [])] });
  children.push(child); child.once("error", () => {});
  return child;
}
async function done(child) {
  if (child.exitCode !== null || child.signalCode !== null) return child.exitCode ?? 1;
  return new Promise((resolve) => child.once("exit", (code) => resolve(code ?? 1)));
}
async function ready(url, child, timeout = 120000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw Error("Local process stopped; private logs retained.");
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return; } catch { /* Startup only. */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw Error("Local process readiness timed out; private logs retained.");
}
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  for (const child of children.toReversed()) if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  await Promise.all(children.map(async (child) => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    await done(child); clearTimeout(timer);
  }));
  for (const log of logs) await log.close();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void stop().then(() => process.exit(0)); });
try {
  const emulator = await launch([path.join(root, "prototypes/firebase-auth/node_modules/firebase-tools/lib/bin/firebase.js"), "emulators:start", "--only", "auth", "--project", "demo-koru-auth-local", "--config", firebaseConfig], "auth-emulator", folder);
  await ready(environment.OKUMA_FIREBASE_EMULATOR_ORIGIN + "/emulator/v1/projects/demo-koru-auth-local/oobCodes", emulator);
  const setup = await launch(["scripts/groups-development.mjs"], "fixtures");
  if (await done(setup) !== 0) throw Error("Local fixtures failed; private logs retained.");
  const web = await launch(["node_modules/vite/bin/vite.js", "--port", String(webPort)], "web");
  await ready(environment.OKUMA_TEST_ORIGIN + "/api/onboarding/config", web);
  console.log("Local Firebase/Koru environment ready: " + environment.OKUMA_TEST_ORIGIN);
  console.log("Fresh synthetic fixture: " + runId + ". No remote accounts, mail or deployment.");
  if (testing) {
    const test = await launch(["scripts/test-firebase-local-integration.mjs"], "tests", root, true);
    test.once("message", (message) => {
      if (message?.type !== "stop-owned-auth-emulator") return;
      emulator.kill("SIGTERM");
      void done(emulator).then(() => { if (test.connected) test.send({ type: "owned-auth-emulator-stopped" }); });
    });
    const timeout = setTimeout(() => test.kill("SIGTERM"), 10 * 60_000);
    const status = await done(test); clearTimeout(timeout);
    if (status !== 0) throw Error("Local integration tests failed; inspect the private fixture test log.");
    console.log("Local integration tests passed; reports are under outputs/release-tests/" + runId + "/firebase-local.");
  } else {
    console.log("Local test mail command: OKUMA_TEST_RUN_ID=" + runId + " corepack pnpm self-service:mail");
    await done(web);
  }
} catch (error) {
  console.error(error.message + " Profile: " + runId); process.exitCode = 1;
} finally { await stop(); }
