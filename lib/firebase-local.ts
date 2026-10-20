import { env } from "cloudflare:workers";
import { ReadingGroupError } from "@/lib/groups";
import { firebaseLocalConfiguration } from "@/lib/firebase-local-policy";

export class FirebaseLocalError extends Error {
  constructor(public readonly code: string) { super("Local identity provider rejected the operation."); }
}
export type FirebaseLocalTokens = { uid: string; idToken: string; refreshToken: string };
export type FirebaseLocalUser = { localId: string; email: string; emailVerified?: boolean; disabled?: boolean; validSince?: string; tenantId?: string };
export function requireFirebaseLocal(url?: string) {
  const config = firebaseLocalConfiguration(env, url);
  if (!config) throw new ReadingGroupError("LOCAL_AUTH_UNAVAILABLE", 503, "Kimlik doğrulama ortamı kullanılamıyor.");
  return config;
}
const allowed = new Set(["signUp", "signInWithPassword", "lookup", "sendOobCode", "update", "resetPassword", "token", "oobCodes"]);
export async function firebaseLocalApi(operation: string, body?: object): Promise<Record<string, unknown>> {
  const { emulatorOrigin, projectId } = requireFirebaseLocal();
  if (!allowed.has(operation)) throw new FirebaseLocalError("INVALID_OPERATION");
  const url = operation === "oobCodes" ? `${emulatorOrigin}/emulator/v1/projects/${projectId}/oobCodes`
    : `${emulatorOrigin}/${operation === "token" ? "securetoken.googleapis.com/v1/token" : "identitytoolkit.googleapis.com/v1/accounts:" + operation}?key=synthetic-local-only`;
  let response: Response;
  try {
    response = await fetch(url, { method: operation === "oobCodes" ? "GET" : "POST", redirect: "manual", credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(5000),
      headers: { "Content-Type": operation === "token" ? "application/x-www-form-urlencoded" : "application/json" },
      ...(body ? { body: operation === "token" ? new URLSearchParams(body as Record<string, string>).toString() : JSON.stringify(body) } : {}) });
  } catch { throw new ReadingGroupError("IDENTITY_UNAVAILABLE", 503, "Kimlik doğrulama hizmetine ulaşılamıyor."); }
  if ((response.status >= 300 && response.status < 400) || response.status >= 500 || response.status === 429) {
    await response.body?.cancel();
    throw new ReadingGroupError("IDENTITY_UNAVAILABLE", 503, "Kimlik doğrulama hizmetine ulaşılamıyor.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new FirebaseLocalError("INVALID_RESPONSE");
  let text = "", size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 262144) { await reader.cancel(); throw new FirebaseLocalError("INVALID_RESPONSE"); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  let data: Record<string, unknown>;
  try { data = JSON.parse(text); } catch { throw new FirebaseLocalError("INVALID_RESPONSE"); }
  if (!response.ok) {
    const code = (data.error as { message?: unknown })?.message;
    const match = typeof code === "string" ? /^([A-Z_]+)(?:\s|:|$)/.exec(code)?.[1] : null;
    throw new FirebaseLocalError(match || "PROVIDER_REJECTED");
  }
  return data;
}
export function firebaseLocalTokens(data: Record<string, unknown>): FirebaseLocalTokens {
  const uid = data.localId ?? data.user_id, idToken = data.idToken ?? data.id_token, refreshToken = data.refreshToken ?? data.refresh_token;
  if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid) || typeof idToken !== "string" || idToken.length > 16384
    || typeof refreshToken !== "string" || !refreshToken.length || refreshToken.length > 8192) throw new FirebaseLocalError("INVALID_IDENTITY");
  return { uid, idToken, refreshToken };
}
export async function firebaseLocalIdentity(tokens: FirebaseLocalTokens, verified = true) {
  const { projectId } = requireFirebaseLocal();
  // Auth Emulator tokens are deliberately unsigned. This branch is loopback/demo
  // only, and EVERY accepted identity is checked against that emulator below.
  let payload: Record<string, unknown>;
  try {
    const [header, value, signature, extra] = tokens.idToken.split(".");
    if (extra !== undefined || signature !== "" || JSON.parse(atob(header.replaceAll("-", "+").replaceAll("_", "/"))).alg !== "none") throw new Error();
    payload = JSON.parse(atob(value.replaceAll("-", "+").replaceAll("_", "/")));
  } catch { throw new FirebaseLocalError("INVALID_IDENTITY"); }
  const now = Math.floor(Date.now() / 1000);
  const firebase = payload.firebase as { sign_in_provider?: string; tenant?: string } | undefined;
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || payload.sub !== tokens.uid
    || !Number.isInteger(payload.exp) || Number(payload.exp) <= now || !Number.isInteger(payload.iat) || Number(payload.iat) > now
    || !Number.isInteger(payload.auth_time) || Number(payload.auth_time) < 0 || Number(payload.auth_time) > Number(payload.iat)
    || firebase?.sign_in_provider !== "password" || firebase?.tenant !== undefined || (verified && payload.email_verified !== true)) throw new FirebaseLocalError("INVALID_IDENTITY");
  const data = await firebaseLocalApi("lookup", { idToken: tokens.idToken });
  const users = data.users as FirebaseLocalUser[];
  if (!Array.isArray(users) || users.length !== 1 || users[0].localId !== tokens.uid || users[0].disabled === true
    || ![undefined, false].includes(users[0].disabled) || users[0].tenantId !== undefined || (verified && users[0].emailVerified !== true) || typeof users[0].validSince !== "string"
    || !/^(?:0|[1-9]\d*)$/.test(users[0].validSince) || !Number.isSafeInteger(Number(users[0].validSince))
    || Number(payload.auth_time) < Number(users[0].validSince)) throw new FirebaseLocalError("INVALID_IDENTITY");
  return { user: users[0], authTime: Number(payload.auth_time) };
}

async function sealingKey() {
  requireFirebaseLocal();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET!), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("demo-koru-auth-local"), info: new TextEncoder().encode("koru-local-firebase-v1") }, key, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function sealFirebaseLocal(value: object, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(context) }, await sealingKey(), new TextEncoder().encode(JSON.stringify(value)));
  return JSON.stringify({ iv: btoa(String.fromCharCode(...iv)), data: btoa(String.fromCharCode(...new Uint8Array(data))) });
}
export async function openFirebaseLocal(value: string, context: string): Promise<Record<string, unknown>> {
  const item = JSON.parse(value) as { iv: string; data: string };
  const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Uint8Array.from(atob(item.iv), (char) => char.charCodeAt(0)), additionalData: new TextEncoder().encode(context) }, await sealingKey(), Uint8Array.from(atob(item.data), (char) => char.charCodeAt(0)));
  return JSON.parse(new TextDecoder().decode(data));
}
