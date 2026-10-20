import { constants } from "node:fs";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { production } from "./web-production-policy.mjs";

export function erasureCommand(args) {
  const allowed = ["--request=", "--digest=", "--confirmation=", "--transfers=", "--ack="];
  if (args.some((arg) => !["--queue", "--execute"].includes(arg) && !allowed.some((prefix) => arg.startsWith(prefix)))
    || new Set(args.map((arg) => arg.split("=")[0])).size !== args.length) throw Error("Invalid erasure options");
  const value = (name) => args.find((arg) => arg.startsWith(name + "="))?.slice(name.length + 1);
  if (args.includes("--queue")) { if (args.length !== 1) throw Error("Queue accepts no mutation options"); return { action: "queue" }; }
  const requestId = value("--request");
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(requestId || "")) throw Error("An exact deletion request is required");
  let transfers = {};
  if (value("--transfers")) transfers = JSON.parse(value("--transfers"));
  if (!transfers || typeof transfers !== "object" || Array.isArray(transfers) || Object.entries(transfers).some(([group, id]) => !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(group) || !Number.isSafeInteger(id) || id <= 0)) throw Error("Invalid successor mapping");
  if (!args.includes("--execute")) {
    if (args.some((arg) => ["--digest=", "--confirmation=", "--ack="].some((prefix) => arg.startsWith(prefix)))) throw Error("Inspection accepts no execution approval");
    return { action: "inspect", requestId, transfers };
  }
  const expectedDigest = value("--digest"), confirmation = value("--confirmation");
  if (!/^[a-f0-9]{64}$/.test(expectedDigest || "") || !new RegExp(`^ERASE:${requestId}:[1-9][0-9]*$`).test(confirmation || "")
    || value("--ack") !== "writers-drained-and-content-reviewed") throw Error("Exact digest, confirmation and independent writer/content review are required");
  return { action: "execute", requestId, transfers, expectedDigest, confirmation, writersStopped: true, contentReviewComplete: true };
}

async function privateKey() {
  const path = resolve(".sites-runtime/koru-production/erasure-operator.key");
  for (const dir of [".sites-runtime", ".sites-runtime/koru-production"]) {
    const stat = await fs.lstat(resolve(dir));
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw Error("Private operator directory required");
  }
  const file = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077) || stat.size > 66) throw Error("Private operator credential required");
    const key = (await file.readFile("utf8")).trim();
    if (!/^[a-f0-9]{64}$/.test(key)) throw Error("Invalid operator credential");
    return key;
  } finally { await file.close(); }
}

async function run() {
  const command = erasureCommand(process.argv.slice(2)), key = await privateKey();
  const endpoint = production.origin + "/api/operations/erasure";
  async function call(body) {
    const response = await fetch(endpoint, { method: "POST", redirect: "error", signal: AbortSignal.timeout(120000), cache: "no-store",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (response.status !== 200 || response.headers.get("content-type")?.split(";")[0] !== "application/json") throw Error("Erasure operation stopped; private response withheld");
    const text = await response.text();
    if (text.length > 32768) throw Error("Invalid operator response");
    return JSON.parse(text);
  }
  if (command.action !== "execute") { console.log(JSON.stringify(await call(command), null, 2)); return; }
  const inspected = await call({ action: "inspect", requestId: command.requestId, transfers: command.transfers });
  if (inspected.digest !== command.expectedDigest || inspected.plan?.confirmation !== command.confirmation || inspected.plan?.blockers?.length) throw Error("Erasure plan changed or is blocked");
  if (inspected.plan?.identity?.count && !inspected.completed) {
    // Local operator ADC only. No service-account private key or Admin SDK is
    // installed in the browser/Worker; the short-lived token is never persisted.
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw Error("Only explicit operator user ADC is supported");
    const adcPath = resolve(homedir(), ".config/gcloud/application_default_credentials.json");
    const file = await fs.open(adcPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    let credentials;
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077) || stat.size > 32768) throw Error("Private operator user ADC required");
      const data = JSON.parse(await file.readFile("utf8"));
      if (data.type !== "authorized_user" || [data.client_id, data.client_secret, data.refresh_token].some((value) => typeof value !== "string" || !value || value.length > 16384)
        || (data.universe_domain && data.universe_domain !== "googleapis.com")) throw Error("Operator user ADC required");
      credentials = { type: "authorized_user", client_id: data.client_id, client_secret: data.client_secret, refresh_token: data.refresh_token };
    } finally { await file.close(); }
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/identitytoolkit"] });
    const client = await auth.getClient();
    if (client.constructor.name !== "UserRefreshClient") throw Error("Operator user ADC required; no service-account/metadata credential accepted");
    const result = await client.getAccessToken();
    if (!result.token) throw Error("Google operator authorization unavailable");
    command.providerAccessToken = result.token;
  }
  let result;
  for (let step = 0; step < 20; step++) {
    result = await call(command);
    if (result.completed === true) break;
    if (result.inProgress !== true || !["frozen", "identity", "groups"].includes(result.phase)) throw Error("Invalid erasure progress");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  delete command.providerAccessToken;
  if (result?.completed !== true) throw Error("Erasure checkpoint saved; explicit retry needed");
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await run().catch(() => {
  console.error("Erasure stopped. No completion is claimed. Review the request/checkpoint and operator authorization; credentials and provider details withheld.");
  process.exitCode = 1;
});
