import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { assertBindings, staging, stagingCredentialsPath, stagingDirectory } from "./staging-policy.mjs";
const require = createRequire(import.meta.url);
const { WebSocket } = createRequire(require.resolve("wrangler/package.json"))("ws");

// An operator-only real Worker check, not a public mail endpoint or a CI send.
const receiptPath = resolve(stagingDirectory, "worker-mail-check.json");
const recipient = "koru.destek+deneme1@gmail.com";
let socket, tailId, cloudToken;
let phase = "preflight";
const base = `/accounts/${staging.accountId}/workers/scripts/${staging.worker}`;
async function api(path, method = "GET", body) {
  const allowed = method === "GET" && path === base + "/settings"
    || method === "POST" && path === base + "/tails"
    || method === "DELETE" && tailId && path === `${base}/tails/${tailId}`;
  if (!allowed) throw new Error("Request outside staging mail check allowlist");
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, {
    method, redirect: "error", signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${cloudToken}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error("Cloudflare mail check request failed");
  return data.result;
}
try {
  if (process.argv[2] !== "--confirm=koru-staging" || process.argv.length > 4 || process.argv[3] !== undefined && process.argv[3] !== "--retry-pre-send") throw new Error("Requires --confirm=koru-staging");
  const previous = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, "utf8")) : null;
  const retry = process.argv[3] === "--retry-pre-send";
  if (retry && (!previous || previous.environment !== staging.worker || previous.status !== "not-confirmed"
    || previous.observed?.outcome !== "ok" || !/^Account email delivery failed gmail phase=(?:mime|refresh) status=(?:network|\d{3})(?: reason=[a-z]+)?$/.test(previous.observed?.diagnostic || "")
    || (previous.previousAttempts?.length || 0) >= 2)) throw new Error("Only confirmed pre-send failures may retry, at most twice");
  if (previous && !retry) {
    console.log("A Worker mail check was already attempted. Receipt preserved; no additional email sent.");
  } else {
    const result = spawnSync(process.execPath, [resolve("node_modules/wrangler/bin/wrangler.js"), "auth", "token", "--json"], {
      encoding: "utf8", timeout: 30_000, env: { ...process.env, WRANGLER_LOG: "log", WRANGLER_WRITE_LOGS: "false", WRANGLER_SEND_METRICS: "false" },
    });
    if (result.status !== 0 || result.error) throw new Error("Cloudflare authorization unavailable");
    const auth = JSON.parse(result.stdout);
    if (!["oauth", "api_token"].includes(auth.type) || !auth.token) throw new Error("Cloudflare login required");
    cloudToken = auth.token;
    phase = "settings";
    const settings = await api(base + "/settings"); assertBindings(settings.bindings);
    for (const [name, text] of Object.entries({ AUTH_PUBLIC_ORIGIN: staging.origin, STAGING_ENVIRONMENT: "true", SELF_SERVICE_ENABLED: "true", SELF_SERVICE_LOCAL: "false" })) {
      if (!settings.bindings.some((b) => b.name === name && b.type === "plain_text" && b.text === text)) throw new Error("Wrong staging mail configuration");
    }
    phase = "tail-create";
    const record = await api(base + "/tails", "POST", { filters: [{ method: ["POST"] }] });
    if (typeof record.id !== "string" || !/^(?:[a-f0-9]{32}|[a-f0-9-]{36})$/.test(record.id) || !record.url?.startsWith("wss://")) throw new Error("Invalid staging tail session");
    tailId = record.id;
    socket = new WebSocket(record.url, "trace-v1");
    let observed;
    socket.addEventListener("message", async (event) => {
      try {
        const raw = typeof event.data === "string" ? event.data : Buffer.from(event.data).toString("utf8");
        const data = JSON.parse(raw);
        if (new URL(data.event?.request?.url || "https://invalid.invalid").pathname !== "/api/onboarding/link-email") return;
        // Raw request headers, bodies, exception messages and URLs are discarded.
        const logs = (data.logs || []).map((item) => Array.isArray(item.message) ? item.message.join(" ") : "");
        const accepted = logs.includes("Account email delivery accepted");
        const diagnostic = logs.find((line) => /^Account email delivery failed(?: gmail phase=(?:mime|refresh|send) status=(?:network|\d{3})(?: reason=(?:http|response|invocation|timeout|aborted|context|network))?(?: trace=(?:[a-zA-Z0-9_.:-]+)(?:,[a-zA-Z0-9_.:-]+){0,2})?| provider)?$/.test(line));
        observed = { outcome: ["ok", "exception", "exceededCpu", "exceededMemory", "canceled"].includes(data.outcome) ? data.outcome : "unknown", accepted,
          diagnostic: diagnostic || null, exceptionCount: data.exceptions?.length || 0 };
      } catch { /* Never reflect telemetry payloads. */ }
    });
    phase = "tail-connect";
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Tail connection timed out")), 15_000);
      socket.addEventListener("open", () => { clearTimeout(timer); socket.send(JSON.stringify({ debug: false })); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Tail connection failed")); }, { once: true });
    });
    const credentials = JSON.parse(readFileSync(stagingCredentialsPath, "utf8"));
    const account = credentials.accounts.find((a) => a.username === "koru.coklu");
    if (!account) throw new Error("Synthetic staging account missing");
    const cookies = new Map();
    async function request(path, body) {
      if (!["/api/auth/login", "/api/onboarding/account", "/api/onboarding/link-email", "/api/auth/logout"].includes(path)) throw new Error("Unexpected mail check endpoint");
      const response = await fetch(staging.origin + path, { method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(30_000),
        headers: { Origin: staging.origin, "Content-Type": "application/json", Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") }, ...(body ? { body: JSON.stringify(body) } : {}),
      });
      for (const line of response.headers.getSetCookie()) { const pair = line.split(";")[0], split = pair.indexOf("="); cookies.set(pair.slice(0, split), pair.slice(split + 1)); }
      const data = await response.json();
      if (!response.ok) throw new Error("Worker mail check rejected");
      return data;
    }
    phase = "fixture-login";
    await request("/api/auth/login", { username: account.username, password: account.password });
    try {
      phase = "fixture-profile";
      if ((await request("/api/onboarding/account")).verified) throw new Error("Synthetic account is already verified; do not replace it");
      const receipt = { environment: staging.worker, transport: "worker-http", status: "attempted", attemptedAt: new Date().toISOString(), inboxConfirmed: false,
        ...(previous ? { previousAttempts: [...previous.previousAttempts || [], { status: previous.status, attemptedAt: previous.attemptedAt, observed: previous.observed }] } : {}) };
      writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), { mode: 0o600, flag: retry ? "w" : "wx" }); chmodSync(receiptPath, 0o600);
      phase = "worker-send";
      await request("/api/onboarding/link-email", { email: recipient, password: account.password });
      const deadline = Date.now() + 40_000;
      while (!observed && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 500));
      Object.assign(receipt, { status: observed?.accepted ? "provider-accepted" : "not-confirmed", observed: observed || null });
      writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), { mode: 0o600 });
      console.log(JSON.stringify(receipt));
    } finally { await request("/api/auth/logout", {}).catch(() => {}); }
  }
} catch { console.error(`Worker mail check failed at ${phase}; sensitive details withheld. No automatic resend.`); process.exitCode = 1; }
finally {
  socket?.terminate();
  if (tailId) await api(`${base}/tails/${tailId}`, "DELETE").catch(() => { console.error("Staging tail cleanup failed; session will expire."); process.exitCode = 1; });
}
