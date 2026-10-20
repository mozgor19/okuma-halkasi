import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DEMO_PROJECT } from "./identity-contract.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const base = path.join(root, ".sites-runtime/firebase-prototype");
const run = path.join(base, "runs", crypto.randomUUID());
await fs.mkdir(run, { recursive: true, mode: 0o700 });
await fs.mkdir(path.join(base, "home"), { recursive: true, mode: 0o700 });

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
const ports = new Set();
while (ports.size < 3) ports.add(await freePort());
const [authPort, hubPort, loggingPort] = ports;
const config = path.join(run, "firebase.json");
await fs.writeFile(config, JSON.stringify({
  emulators: {
    auth: { host: "127.0.0.1", port: authPort },
    hub: { host: "127.0.0.1", port: hubPort },
    logging: { host: "127.0.0.1", port: loggingPort },
    ui: { enabled: false }, singleProjectMode: true,
  },
}), { mode: 0o600 });
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/^(GOOGLE|GCLOUD|GCP|FIREBASE|CLOUDSDK|KORU_FIREBASE|OKUMA_)/.test(key)));
Object.assign(environment, {
  HOME: path.join(base, "home"), XDG_CONFIG_HOME: path.join(base, "home/.config"),
  CI: "true", FIREBASE_CLI_DISABLE_UPDATE_CHECK: "true", FIREBASE_CLI_DISABLE_TELEMETRY: "true",
  GCLOUD_PROJECT: DEMO_PROJECT, GOOGLE_CLOUD_PROJECT: DEMO_PROJECT,
  FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${authPort}`,
  KORU_FIREBASE_LOCAL_ONLY: "true", KORU_FIREBASE_REPORT: path.join(run, "report.json"),
});
const log = await fs.open(path.join(run, "emulator.log"), "wx", 0o600);
const cli = path.join(here, "node_modules/firebase-tools/lib/bin/firebase.js");
const testCommand = `${JSON.stringify(process.execPath)} --test ${JSON.stringify(path.join(here, "emulator.test.mjs"))}`;
const child = spawn(process.execPath, [cli, "emulators:exec", "--only", "auth", "--project", DEMO_PROJECT,
  "--config", config, testCommand], { cwd: run, env: environment, stdio: ["ignore", log.fd, log.fd] });
const timeout = setTimeout(() => child.kill("SIGTERM"), 120000);
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => child.kill("SIGTERM"));
const status = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code) => resolve(code ?? 1));
});
clearTimeout(timeout);
await log.close();
if (status !== 0) {
  console.error(`Local Firebase prototype failed. Private log: ${path.relative(root, path.join(run, "emulator.log"))}`);
  process.exitCode = status;
} else {
  const report = JSON.parse(await fs.readFile(environment.KORU_FIREBASE_REPORT, "utf8"));
  console.log(JSON.stringify({ ...report, report: path.relative(root, environment.KORU_FIREBASE_REPORT) }, null, 2));
}
