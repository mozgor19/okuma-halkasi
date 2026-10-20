export function browserSecurityHeaders(turnstile = false, nonce?: string, development = false) {
  return {
    "Content-Security-Policy": [
      ...(nonce && !development ? [
        `script-src 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval' 'self'${turnstile ? " https://challenges.cloudflare.com" : ""}`,
        "script-src-attr 'none'", "worker-src 'self' blob:",
      ] : []),
      `connect-src 'self'${turnstile ? " https://challenges.cloudflare.com" : ""}`,
      "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'",
      `frame-src ${turnstile ? "https://challenges.cloudflare.com" : "'none'"}`,
    ].join("; "),
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "payment=(), usb=(), serial=()",
  };
}
