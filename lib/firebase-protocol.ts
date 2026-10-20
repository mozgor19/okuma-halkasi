import { createRemoteJWKSet, customFetch, jwtVerify, type JWTVerifyGetKey } from "jose";

export type FirebaseTokens = { uid: string; idToken: string; refreshToken: string };
export type FirebaseIdentity = { uid: string; email: string; verified: boolean; authTime: number; validSince: number; expires: number };
export class FirebaseError extends Error {
  readonly code: string;
  constructor(code: string) { super("Kimlik doğrulama işlemi tamamlanamadı."); this.code = code; }
}

const remoteKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"), {
  timeoutDuration: 5000,
  [customFetch]: async (url, options) => {
    try {
      const response = await fetch(url, { ...options, redirect: "manual", credentials: "omit", cache: "no-store" });
      if (response.status !== 200) { await response.body?.cancel(); throw new FirebaseError("UNAVAILABLE"); }
      return Response.json(await readFirebaseJson(response));
    } catch { throw new FirebaseError("UNAVAILABLE"); }
  },
});

export async function readFirebaseJson(response: Response): Promise<Record<string, unknown>> {
  if (response.redirected || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    await response.body?.cancel(); throw new FirebaseError("INVALID_RESPONSE");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new FirebaseError("INVALID_RESPONSE");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 32768) throw new FirebaseError("INVALID_RESPONSE");
      chunks.push(value);
    }
  } catch { await reader.cancel(); throw new FirebaseError("INVALID_RESPONSE"); }
  finally { reader.releaseLock(); }
  try {
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw Error();
    return data;
  } catch { throw new FirebaseError("INVALID_RESPONSE"); }
}

export function firebaseTokens(data: Record<string, unknown>): FirebaseTokens {
  const uid = data.localId ?? data.user_id ?? data.uid, idToken = data.idToken ?? data.id_token, refreshToken = data.refreshToken ?? data.refresh_token;
  if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid) || typeof idToken !== "string" || !idToken || idToken.length > 16384
    || typeof refreshToken !== "string" || !refreshToken || refreshToken.length > 8192) throw new FirebaseError("INVALID_IDENTITY");
  return { uid, idToken, refreshToken };
}

type Operation = "signUp" | "signInWithPassword" | "lookup" | "sendOobCode" | "update" | "resetPassword" | "delete" | "token";
export function firebaseClient(config: { projectId: string; apiKey: string }, options: { request?: typeof fetch; keys?: JWTVerifyGetKey } = {}) {
  const request = options.request || fetch;
  const allowed = new Set(["signUp", "signInWithPassword", "lookup", "sendOobCode", "update", "resetPassword", "delete", "token"]);
  async function api(operation: Operation, body: object): Promise<Record<string, unknown>> {
    if (!allowed.has(operation)) throw new FirebaseError("INVALID_OPERATION");
    const url = new URL(operation === "token" ? "https://securetoken.googleapis.com/v1/token" : "https://identitytoolkit.googleapis.com/v1/accounts:" + operation);
    url.searchParams.set("key", config.apiKey);
    let response: Response;
    try {
      response = await request(url.href, { method: "POST", redirect: "manual", credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": operation === "token" ? "application/x-www-form-urlencoded" : "application/json", "X-Firebase-Locale": "tr" },
        body: operation === "token" ? new URLSearchParams(body as Record<string, string>).toString() : JSON.stringify(body) });
    } catch { throw new FirebaseError("UNAVAILABLE"); }
    if (response.status === 429 || response.status >= 500 || (response.status >= 300 && response.status < 400)) {
      await response.body?.cancel(); throw new FirebaseError("UNAVAILABLE");
    }
    const data = await readFirebaseJson(response);
    if (!response.ok) {
      const value = (data.error as { message?: unknown } | undefined)?.message;
      const code = typeof value === "string" ? /^([A-Z_]+)(?:\s|:|$)/.exec(value)?.[1] : null;
      throw new FirebaseError(code || "REJECTED");
    }
    return data;
  }
  async function identity(tokens: FirebaseTokens, verified = true): Promise<FirebaseIdentity> {
    try {
      const { payload, protectedHeader } = await jwtVerify(tokens.idToken, options.keys || remoteKeys, {
        algorithms: ["RS256"], audience: config.projectId, issuer: `https://securetoken.google.com/${config.projectId}`,
        requiredClaims: ["sub", "iat", "exp", "auth_time", "email"],
      });
      const now = Math.floor(Date.now() / 1000), firebase = payload.firebase as { sign_in_provider?: unknown; tenant?: unknown } | undefined;
      if (typeof protectedHeader.kid !== "string" || !protectedHeader.kid || payload.aud !== config.projectId || payload.sub !== tokens.uid
        || !Number.isInteger(payload.iat) || Number(payload.iat) > now || !Number.isInteger(payload.exp) || Number(payload.exp) <= now
        || !Number.isInteger(payload.auth_time) || Number(payload.auth_time) < 0 || Number(payload.auth_time) > Number(payload.iat)
        || firebase?.sign_in_provider !== "password" || firebase?.tenant !== undefined || typeof payload.email !== "string"
        || (verified && payload.email_verified !== true)) throw new FirebaseError("INVALID_IDENTITY");
      const data = await api("lookup", { idToken: tokens.idToken }), users = data.users as Array<Record<string, unknown>>;
      const user = Array.isArray(users) && users.length === 1 ? users[0] : null;
      if (!user || user.localId !== tokens.uid || ![false, undefined].includes(user.disabled as false | undefined) || user.tenantId !== undefined
        || typeof user.email !== "string" || user.email.toLowerCase() !== payload.email.toLowerCase()
        || (verified && user.emailVerified !== true) || typeof user.validSince !== "string" || !/^(?:0|[1-9]\d*)$/.test(user.validSince)
        || !Number.isSafeInteger(Number(user.validSince)) || Number(payload.auth_time) < Number(user.validSince)) throw new FirebaseError("INVALID_IDENTITY");
      return { uid: tokens.uid, email: user.email.toLowerCase(), verified: user.emailVerified === true, authTime: Number(payload.auth_time), validSince: Number(user.validSince), expires: Number(payload.exp) };
    } catch (error) {
      if (error instanceof FirebaseError && error.code === "UNAVAILABLE") throw error;
      throw new FirebaseError("INVALID_IDENTITY");
    }
  }
  return { api, identity };
}
