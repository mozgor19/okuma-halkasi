import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const toolchain = createRequire(require.resolve("wrangler/package.json"));
const { Miniflare } = toolchain("miniflare");
const { build } = toolchain("esbuild");
const { outputFiles } = await build({
  stdin: { resolveDir: process.cwd(), sourcefile: "gmail-worker-test.ts", contents: `
    import { sendGmailMail, GMAIL_SEND_SCOPE } from "./lib/gmail-mail.ts";
    export default {
      async fetch() {
        try {
          const id = await sendGmailMail({ environment: "koru-staging", origin: "https://staging.example.com",
            intendedSender: "sender@gmail.com", clientId: "test.apps.googleusercontent.com", clientSecret: "synthetic-secret",
            refreshToken: "synthetic-refresh", scope: GMAIL_SEND_SCOPE,
            authorizedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() },
            { recipient: "reader@example.com", replyTo: "sender@gmail.com", subject: "Koru test", text: "Synthetic verification link" });
          return Response.json({ ok: true, id });
        } catch (error) {
          return Response.json({ ok: false, phase: error.phase, status: error.status, retryable: error.retryable });
        }
      }
    };` },
  bundle: true, write: false, format: "esm", platform: "browser", target: "es2022",
});
const script = outputFiles[0].text;
const refreshReply = { access_token: "synthetic-access", token_type: "Bearer", expires_in: 3600, scope: "https://www.googleapis.com/auth/gmail.send" };

async function inWorker(replies, expected) {
  const pending = [...replies], visited = [];
  const worker = new Miniflare({ modules: true, compatibilityDate: "2026-05-15", script,
    outboundService(request) {
      visited.push(request.url);
      const reply = pending.shift();
      assert.ok(reply, "Unexpected outbound request, including a followed redirect");
      assert.equal(request.url, reply.url); assert.equal(request.method, "POST");
      return new Response(JSON.stringify(reply.body || {}), { status: reply.status || 200, headers: reply.headers });
    },
  });
  try {
    const response = await worker.dispatchFetch("http://localhost/test");
    assert.deepEqual(await response.json(), expected);
    assert.equal(pending.length, 0); assert.equal(visited.length, replies.length);
  } finally { await worker.dispose(); }
}

const refreshUrl = "https://oauth2.googleapis.com/token";
const sendUrl = "https://gmail.googleapis.com/gmail/v1/users/sender%40gmail.com/messages/send";

test("real Worker native fetch can refresh and send through the actual Gmail adapter", async () => {
  await inWorker([{ url: refreshUrl, body: refreshReply }, { url: sendUrl, body: { id: "synthetic-message" } }], { ok: true, id: "synthetic-message" });
});

test("Worker OAuth redirects are rejected without forwarding refresh credentials", async () => {
  await inWorker([{ url: refreshUrl, status: 302, headers: { location: "https://never-follow.example.com/secret" } }], { ok: false, phase: "refresh", status: 302, retryable: false });
});

test("Worker send redirects are rejected without forwarding bearer tokens or repeating mail", async () => {
  await inWorker([{ url: refreshUrl, body: refreshReply }, { url: sendUrl, status: 307, headers: { location: "https://never-follow.example.com/secret" } }], { ok: false, phase: "send", status: 307, retryable: false });
});
