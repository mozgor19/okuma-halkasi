export function browserSecurityHeaders(turnstile = false) {
  return {
    "Content-Security-Policy": [
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
