import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pbkdf2Sync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { Miniflare } = createRequire(require.resolve("wrangler/package.json"))("miniflare");
const password = "Synthetic-runtime-probe-7429";
const salt = "0123456789abcdef0123456789abcdef";
const worker = new Miniflare({
  modules: true, compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"],
  script: `import { pbkdf2 } from 'node:crypto';
    export default { async fetch(request) {
      const { iterations } = await request.json();
      const started = Date.now();
      try {
        const hash = await new Promise((resolve, reject) => pbkdf2(${JSON.stringify(password)}, Buffer.from(${JSON.stringify(salt)}, 'hex'), iterations, 32, 'sha256', (error, result) => error ? reject(error) : resolve(result)));
        return Response.json({ ok:true, hash:hash.toString('hex'), wallMs:Date.now()-started });
      } catch { return Response.json({ ok:false, wallMs:Date.now()-started }); }
    }};`,
});
try {
  const samples = [];
  for (const iterations of [100_000, 200_000, 600_000]) {
    const result = await (await worker.dispatchFetch("http://probe.invalid/", { method: "POST", body: JSON.stringify({ iterations }) })).json();
    assert.equal(result.ok, true, `Runtime does not support ${iterations} iterations`);
    assert.equal(result.hash, pbkdf2Sync(password, Buffer.from(salt, "hex"), iterations, 32, "sha256").toString("hex"));
    samples.push({ iterations, matchesStandardVector: true, wallMs: result.wallMs });
  }
  mkdirSync("outputs/web-security", { recursive: true });
  const report = { checkedAt: new Date().toISOString(), runtime: "Local workerd via Miniflare, nodejs_compat", samples, limitations: "Local workerd has different configured limits. node:crypto also calls checkPbkdfLimits; it does NOT bypass the remote PBKDF2 cap. Wall time is not Cloudflare Free-plan CPU-budget evidence; remote acceptance is separate." };
  writeFileSync("outputs/web-security/password-runtime-probe.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await worker.dispose(); }
