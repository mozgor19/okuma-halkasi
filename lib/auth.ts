import { env } from "cloudflare:workers";

export const SESSION_COOKIE = "okuma_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

type MemberCredential = { memberId: number; password: string };
type AuthConfiguration = { credentials: Record<string, MemberCredential>; secret: string };
type ConfigurationResult =
  | { config: AuthConfiguration; issue: null }
  | { config: null; issue: string };

const encoder = new TextEncoder();

function configurationResult(): ConfigurationResult {
  const rawCredentials = env.MEMBER_CREDENTIALS;
  if (!rawCredentials) {
    return { config: null, issue: "MEMBER_CREDENTIALS Secret'ı Worker çalışma ortamında bulunamadı." };
  }

  const secret = env.SESSION_SECRET;
  if (!secret) {
    return { config: null, issue: "SESSION_SECRET Secret'ı Worker çalışma ortamında bulunamadı." };
  }
  if (secret.length < 32) {
    return { config: null, issue: "SESSION_SECRET en az 32 karakter olmalı." };
  }

  try {
    const raw = JSON.parse(rawCredentials) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { config: null, issue: "MEMBER_CREDENTIALS geçerli bir JSON nesnesi değil." };
    }

    const entries = Object.entries(raw);
    if (!entries.length) {
      return { config: null, issue: "MEMBER_CREDENTIALS içinde en az bir üye olmalı." };
    }

    const valid = entries.every(([username, credential]) =>
      /^[a-z0-9._-]{2,40}$/.test(username)
      && !!credential
      && typeof credential === "object"
      && Number.isInteger((credential as MemberCredential).memberId)
      && (credential as MemberCredential).memberId > 0
      && typeof (credential as MemberCredential).password === "string"
      && (credential as MemberCredential).password.length > 0
      && (credential as MemberCredential).password.length <= 200
    );
    if (!valid) {
      return { config: null, issue: "MEMBER_CREDENTIALS içindeki kullanıcı adı, memberId veya password alanlarından biri geçersiz." };
    }

    return {
      config: {
        credentials: Object.fromEntries(entries) as Record<string, MemberCredential>,
        secret,
      },
      issue: null,
    };
  } catch {
    return { config: null, issue: "MEMBER_CREDENTIALS JSON biçimi geçersiz." };
  }
}

function configuration(): AuthConfiguration | null {
  return configurationResult().config;
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
  return configurationResult().issue;
}

export function authIsConfigured(): boolean {
  return authConfigurationIssue() === null;
}

export async function authenticateMember(username: string, password: string): Promise<number | null> {
  const config = configuration();
  const normalizedUsername = username.trim().toLowerCase();
  const credential = config?.credentials[normalizedUsername];
  if (!config || !credential || !(await valuesMatch(config.secret, credential.password, password))) return null;
  return credential.memberId;
}

export async function createSessionToken(memberId: number): Promise<string> {
  const config = configuration();
  if (!config || !Number.isInteger(memberId) || memberId < 1) throw new Error("Authentication is not configured.");
  const payload = `${memberId}:${Date.now() + SESSION_MAX_AGE * 1000}`;
  return payload + "." + toHex(await hmac(config.secret, payload));
}

export async function sessionMemberId(token: string | undefined): Promise<number | null> {
  const config = configuration();
  if (!config || !token) return null;
  try { token = decodeURIComponent(token); } catch { return null; }
  const [payload, signature, extra] = token.split(".");
  if (extra !== undefined || !payload) return null;
  const [memberIdValue, expiresAtValue, payloadExtra] = payload.split(":");
  if (payloadExtra !== undefined || !/^\d+$/.test(memberIdValue ?? "") || !/^\d{13}$/.test(expiresAtValue ?? "")) return null;
  const memberId = Number(memberIdValue);
  const expiration = Number(expiresAtValue);
  if (!Number.isInteger(memberId) || memberId < 1 || expiration <= Date.now() || expiration > Date.now() + SESSION_MAX_AGE * 1000) return null;
  const bytes = fromHex(signature ?? "");
  if (!bytes) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(config.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return await crypto.subtle.verify("HMAC", key, bytes, encoder.encode(payload)) ? memberId : null;
}

export function sessionTokenFromRequest(request: Request): string | undefined {
  const cookie = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return cookie?.slice(SESSION_COOKIE.length + 1);
}
