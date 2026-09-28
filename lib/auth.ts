import { env } from "cloudflare:workers";

export const SESSION_COOKIE = "okuma_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

function configuration() {
  const password = env.GROUP_PASSWORD;
  const secret = env.SESSION_SECRET;
  if (!password || !secret || secret.length < 32) return null;
  return { password, secret };
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

function fromHex(value: string): Uint8Array | null {
  if (!/^[a-f0-9]{64}$/.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

export function authIsConfigured(): boolean {
  return configuration() !== null;
}

export async function passwordIsValid(candidate: string): Promise<boolean> {
  const config = configuration();
  if (!config) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(config.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const expected = await hmac(config.secret, config.password);
  return crypto.subtle.verify("HMAC", key, expected, encoder.encode(candidate));
}

export async function createSessionToken(): Promise<string> {
  const config = configuration();
  if (!config) throw new Error("Authentication is not configured.");
  const expiresAt = String(Date.now() + SESSION_MAX_AGE * 1000);
  return expiresAt + "." + toHex(await hmac(config.secret, expiresAt));
}

export async function sessionIsValid(token: string | undefined): Promise<boolean> {
  const config = configuration();
  if (!config || !token) return false;
  const [expiresAt, signature, extra] = token.split(".");
  if (extra !== undefined || !/^\d{13}$/.test(expiresAt ?? "")) return false;
  const expiration = Number(expiresAt);
  if (expiration <= Date.now() || expiration > Date.now() + SESSION_MAX_AGE * 1000) return false;
  const bytes = fromHex(signature ?? "");
  if (!bytes) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(config.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(expiresAt));
}
