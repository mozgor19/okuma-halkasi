import { pbkdf2 } from "node:crypto";

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/ready" && !url.search) return Response.json({ probe: "koru-password-probe-v1", runId: env.KORU_PASSWORD_PROBE_RUN }, { headers: { "Cache-Control": "no-store" } });
    const iterations = Number(url.pathname.slice(1));
    if (request.method !== "GET" || url.search || !/^\/(100000|200000|600000)$/.test(url.pathname)) {
      return new Response("Not found", { status: 404 });
    }
    const start = Date.now();
    try {
      const hash = await new Promise((resolve, reject) => pbkdf2("Synthetic-Koru-Runtime-48296", Buffer.from("0123456789abcdef0123456789abcdef", "hex"), iterations, 32, "sha256",
        (error, result) => error ? reject(error) : resolve(result)));
      return Response.json({ runId: env.KORU_PASSWORD_PROBE_RUN, iterations, supported: true, hash: hash.toString("hex"), wallMs: Date.now() - start }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const iterationCap = /iteration|pbkdf/i.test(String(error?.message));
      return Response.json({ runId: env.KORU_PASSWORD_PROBE_RUN, iterations, supported: false, reason: iterationCap ? "runtime-pbkdf-limit" : "crypto-error", wallMs: Date.now() - start }, { headers: { "Cache-Control": "no-store" } });
    }
  },
};
export default worker;
