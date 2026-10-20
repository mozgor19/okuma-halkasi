import { signedTokenVerifier } from "./identity-contract.mjs";
import { readProviderJson } from "./provider-http.mjs";

// Prototype: signed JWT first, then uncached provider status on EVERY call.
// This does not create Koru cookies or replace canonical UID/erasure guards.
export function providerCheckedVerifier({ projectId, apiKey, keySet, request = fetch }) {
  if (typeof apiKey !== "string" || !/^[A-Za-z0-9_-]{20,200}$/.test(apiKey) || typeof request !== "function") throw Error("AUTH_PROVIDER_CONFIG");
  const signed = signedTokenVerifier(projectId, keySet);
  const endpoint = new URL("https://identitytoolkit.googleapis.com/v1/accounts:lookup");
  endpoint.searchParams.set("key", apiKey);
  return async (idToken) => {
    try {
      const identity = await signed(idToken);
      const response = await request(endpoint.href, {
        method: "POST", redirect: "error", cache: "no-store", credentials: "omit",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ idToken }), signal: AbortSignal.timeout(5000),
      });
      const data = await readProviderJson(response);
      if (!Array.isArray(data.users) || data.users.length !== 1) throw Error("AUTH_PROVIDER_IDENTITY");
      const user = data.users[0];
      if (!user || user.localId !== identity.uid || user.emailVerified !== true
        || ![undefined, false].includes(user.disabled) || user.tenantId !== undefined
        || typeof user.validSince !== "string" || !/^(?:0|[1-9]\d*)$/.test(user.validSince)) throw Error("AUTH_PROVIDER_IDENTITY");
      const validAfter = Number(user.validSince);
      if (!Number.isSafeInteger(validAfter) || identity.authTime < validAfter) throw Error("AUTH_PROVIDER_REVOKED");
      return identity;
    } catch {
      // Provider/JWT diagnostics can contain ID tokens, URLs and personal data.
      throw Error("AUTH_IDENTITY_UNAVAILABLE");
    }
  };
}
