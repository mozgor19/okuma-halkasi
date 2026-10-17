export const POLICY_VERSION = "2026-10-17";
export const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
export const REQUEST_KEY_PATTERN = /^[a-f0-9-]{36}$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  // International display names are supported; email addresses are ASCII for reliable delivery.
  return email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email)
    && !email.includes("..") && !email.startsWith(".") && !email.includes(".@") ? email : null;
}

export function cleanName(value: unknown, maximum = 100): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/gu, " ");
  return name.length >= 2 && name.length <= maximum && !/[\u0000-\u001f\u007f<>]/u.test(name) ? name : null;
}

export function loopback(url: URL): boolean {
  return url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
}

export function publicHttpsOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash
      || !url.hostname.includes(".") || /(?:\.(?:local|localhost|test|invalid)$)|^(?:127\.|10\.|192\.168\.|169\.254\.|0\.)|^172\.(?:1[6-9]|2\d|3[01])\./i.test(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
}

export function publicHttpsUrl(value: string | undefined): boolean {
  try {
    const url = new URL(value || "");
    return !url.username && !url.password && !!publicHttpsOrigin(url.origin);
  } catch { return false; }
}

export function bindingNames(value: string | undefined): string[] {
  const names: unknown = JSON.parse(value || "[]");
  if (!Array.isArray(names) || names.length > 100 || !names.every((name) => typeof name === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(name) && name !== "DB")
    || new Set(names).size !== names.length) throw new Error("Invalid group binding pool.");
  return names;
}

export function newToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function tokenHash(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
