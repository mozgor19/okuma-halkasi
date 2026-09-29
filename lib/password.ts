const encoder = new TextEncoder();
const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_BYTES = 32;
const SALT_BYTES = 16;

function toHex(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): ArrayBuffer | null {
  if (!/^[a-f0-9]+$/.test(value) || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes.buffer;
}

async function derivePassword(password: string, salt: ArrayBuffer, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    PASSWORD_BYTES * 8,
  );
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function passwordValidationIssue(password: string, username: string): string | null {
  if (password.length < 12) return "Yeni şifre en az 12 karakter olmalı.";
  if (password.length > 200) return "Yeni şifre en fazla 200 karakter olabilir.";
  if (!/[a-zçğıöşü]/i.test(password) || !/\d/.test(password)) {
    return "Yeni şifre en az bir harf ve bir rakam içermeli.";
  }

  const compactUsername = normalizeUsername(username).replace(/[^a-z0-9]/g, "");
  const compactPassword = password.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compactUsername.length >= 4 && compactPassword.includes(compactUsername)) {
    return "Yeni şifre kullanıcı adını içermemeli.";
  }
  return null;
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string; iterations: number }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derivePassword(password, saltBytes.buffer, PASSWORD_ITERATIONS);
  return { hash: toHex(hash), salt: toHex(saltBytes), iterations: PASSWORD_ITERATIONS };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string,
  iterations: number,
): Promise<boolean> {
  const expected = fromHex(storedHash);
  const salt = fromHex(storedSalt);
  if (!expected || expected.byteLength !== PASSWORD_BYTES || !salt || salt.byteLength !== SALT_BYTES) return false;
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) return false;
  const candidate = await derivePassword(password, salt, iterations);
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean;
  };
  return subtle.timingSafeEqual(expected, candidate);
}
