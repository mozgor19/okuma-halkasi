import { createRemoteJWKSet, jwtVerify } from "jose";

export const DEMO_PROJECT = "demo-koru-auth-local";
const keysUrl = new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
const keys = createRemoteJWKSet(keysUrl, { timeoutDuration: 5000 });

// Signed-token candidate for Workers. Never accepts emulator tokens or URLs.
export function signedTokenVerifier(projectId, keySet = keys) {
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) throw Error("INVALID_PROJECT");
  return async (token) => {
    if (typeof token !== "string" || token.length > 16384) throw Error("INVALID_TOKEN");
    const { payload, protectedHeader } = await jwtVerify(token, keySet, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "iat", "exp", "auth_time"],
    });
    const now = Math.floor(Date.now() / 1000);
    if (typeof protectedHeader.kid !== "string" || !protectedHeader.kid
      || payload.aud !== projectId
      || typeof payload.sub !== "string" || !payload.sub.length || payload.sub.length > 128
      || !Number.isInteger(payload.iat) || payload.iat > now
      || !Number.isInteger(payload.auth_time) || payload.auth_time > payload.iat
      || payload.auth_time < 0
      || payload.firebase?.sign_in_provider !== "password"
      || payload.firebase?.tenant !== undefined
      || payload.email_verified !== true) throw Error("INVALID_IDENTITY");
    return { uid: payload.sub, authTime: payload.auth_time };
  };
}

// Only the server-provisioned UID link grants access. Email/custom claims never do.
export function linkedIdentity(store, projectId, identity, { requireRecent = false } = {}) {
  const account = store.byUid(projectId, identity.uid);
  const now = Math.floor(Date.now() / 1000);
  if (!account || account.erasureBlocked !== false || account.disabled !== false
    || !Number.isSafeInteger(account.accountId) || account.accountId < 1
    || !Number.isSafeInteger(account.sessionVersion) || account.sessionVersion < 1
    || !Number.isInteger(account.validAfter) || account.validAfter < 0
    || !Number.isInteger(identity.authTime) || identity.authTime > now
    || identity.authTime < account.validAfter
    || (requireRecent && now - identity.authTime > 300)) throw Error("ACCOUNT_ACCESS_DENIED");
  return { accountId: account.accountId, sessionVersion: account.sessionVersion };
}

export function approvedImportRecord(row) {
  if (!Number.isSafeInteger(row.accountId) || row.accountId < 1 || row.erasureBlocked
    || row.emailVerified !== true || typeof row.email !== "string"
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)
    || !/^[a-f0-9]{64}$/.test(row.hash) || !/^[a-f0-9]{32}$/.test(row.salt)
    || row.iterations !== 100000) {
    throw Error("IMPORT_REQUIRES_MANUAL_RECOVERY");
  }
  return {
    user: {
      uid: `koru-account-${row.accountId}`,
      email: row.email,
      emailVerified: true,
      passwordHash: Buffer.from(row.hash, "hex"),
      passwordSalt: Buffer.from(row.salt, "hex"),
    },
    options: { hash: { algorithm: "PBKDF2_SHA256", rounds: row.iterations } },
  };
}
