import { env } from "cloudflare:workers";

export const SESSION_COOKIE = "okuma_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

type MemberCredential = { memberId: number; password: string };
export type SessionIdentity = { memberId: number; sessionVersion: number };

const encoder = new TextEncoder();

function sessionSecret(): string | null {
  const secret = env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function legacyCredentials(): Record<string, MemberCredential> | null {
  try {
    const raw = JSON.parse(env.MEMBER_CREDENTIALS ?? "") as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const entries = Object.entries(raw);
    const valid = entries.length > 0 && entries.every(([username, credential]) =>
      /^[a-z0-9._-]{2,40}$/.test(username)
      && !!credential
      && typeof credential === "object"
      && Number.isInteger((credential as MemberCredential).memberId)
      && (credential as MemberCredential).memberId > 0
      && typeof (credential as MemberCredential).password === "string"
      && (credential as MemberCredential).password.length > 0
      && (credential as MemberCredential).password.length <= 200
    );
    return valid ? Object.fromEntries(entries) as Record<string, MemberCredential> : null;
  } catch {
    return null;
  }
}

async function hmac(secret: string, value: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return crypto.subtle.sign("HMAC", key, encoder.encode(value));
}

function toHex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): ArrayBuffer | null {
  if (!/^[a-f0-9]{64}$/.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes.buffer;
}

async function valuesMatch(secret: string, expected: string, candidate: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, await hmac(secret, expected), encoder.encode(candidate));
}

export function authConfigurationIssue(): string | null {
  const secret = env.SESSION_SECRET;
  if (!secret) return "SESSION_SECRET Secret'ı Worker çalışma ortamında bulunamadı.";
  if (secret.length < 32) return "SESSION_SECRET en az 32 karakter olmalı.";
  return null;
}

export function authIsConfigured(): boolean {
  return authConfigurationIssue() === null;
}

export async function authenticateLegacyMember(username: string, password: string): Promise<number | null> {
  const credentials = legacyCredentials();
  const secret = sessionSecret();
  if (!credentials || !secret) return null;
  const credential = credentials[username.trim().toLowerCase()];
  const valid = await valuesMatch(secret, credential?.password ?? "", password);
  return valid && credential ? credential.memberId : null;
}

export async function legacyUsernameForMember(memberId: number, password: string): Promise<string | null> {
  const credentials = legacyCredentials();
  const secret = sessionSecret();
  if (!credentials || !secret) return null;
  const entry = Object.entries(credentials).find(([, credential]) => credential.memberId === memberId);
  if (!entry || !(await valuesMatch(secret, entry[1].password, password))) return null;
  return entry[0];
}

export async function createSessionToken(memberId: number, sessionVersion: number): Promise<string> {
  const secret = sessionSecret();
  if (!secret || !Number.isInteger(memberId) || memberId < 1 || !Number.isInteger(sessionVersion) || sessionVersion < 0) {
    throw new Error("Authentication is not configured.");
  }
  const payload = `${memberId}:${sessionVersion}:${Date.now() + SESSION_MAX_AGE * 1000}`;
  return payload + "." + toHex(await hmac(secret, payload));
}

export async function sessionIdentity(token: string | undefined): Promise<SessionIdentity | null> {
  const secret = sessionSecret();
  if (!secret || !token) return null;
  try { token = decodeURIComponent(token); } catch { return null; }
  const [payload, signature, extra] = token.split(".");
  if (extra !== undefined || !payload) return null;
  const [memberIdValue, sessionVersionValue, expiresAtValue, payloadExtra] = payload.split(":");
  if (
    payloadExtra !== undefined
    || !/^\d+$/.test(memberIdValue ?? "")
    || !/^\d+$/.test(sessionVersionValue ?? "")
    || !/^\d{13}$/.test(expiresAtValue ?? "")
  ) return null;
  const memberId = Number(memberIdValue);
  const sessionVersion = Number(sessionVersionValue);
  const expiration = Number(expiresAtValue);
  if (
    !Number.isInteger(memberId)
    || memberId < 1
    || !Number.isInteger(sessionVersion)
    || sessionVersion < 0
    || expiration <= Date.now()
    || expiration > Date.now() + SESSION_MAX_AGE * 1000
  ) return null;
  const bytes = fromHex(signature ?? "");
  if (!bytes) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify("HMAC", key, bytes, encoder.encode(payload));
  return valid ? { memberId, sessionVersion } : null;
}

export function sessionTokenFromRequest(request: Request): string | undefined {
  const cookie = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return cookie?.slice(SESSION_COOKIE.length + 1);
}
