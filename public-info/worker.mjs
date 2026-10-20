export const infoSecurityHeaders = Object.freeze({
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
});

function secured(response, head = false) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(infoSecurityHeaders)) headers.set(name, value);
  headers.delete("Set-Cookie");
  headers.set("Cache-Control", response.ok && !headers.get("Content-Type")?.includes("text/html")
    ? "public, max-age=3600, must-revalidate" : "public, max-age=0, must-revalidate");
  headers.set("X-Koru-Site", "public-information-v1");
  return new Response(head ? null : response.body, { status: response.status, headers });
}

const worker = {
  async fetch(request, env) {
    if (!["GET", "HEAD"].includes(request.method)) return secured(new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } }));
    const url = new URL(request.url);
    // This Worker has no account API, proxy, cookies, credentials or DB binding.
    if (/^\/(?:api|login|register|groups)(?:\/|$)/.test(url.pathname)) return secured(new Response("Not found", { status: 404 }), request.method === "HEAD");
    url.search = "";
    const assetRequest = new Request(url, { method: "GET" });
    return secured(await env.ASSETS.fetch(assetRequest), request.method === "HEAD");
  },
};
export default worker;
