import { pbkdf2, timingSafeEqual } from "node:crypto";
import { env } from "cloudflare:workers";
import { PASSWORD_ITERATIONS, passwordIterationsSupported as validWorkFactor } from "@/lib/password-policy";

export {
  PASSWORD_ITERATIONS,
  normalizeUsername,
  passwordValidationIssue,
} from "@/lib/password-policy";

const PASSWORD_BYTES = 32;
const SALT_BYTES = 16;

export function passwordHashIterations(): number {
  if (!env.PASSWORD_HASH_ITERATIONS || env.PASSWORD_HASH_ITERATIONS === "100000") return 100_000;
  if (env.PASSWORD_HASH_ITERATIONS === String(PASSWORD_ITERATIONS)) return PASSWORD_ITERATIONS;
  throw new Error("Password work factor requires runtime review.");
}

export function passwordIterationsSupported(iterations: number): boolean {
  return validWorkFactor(iterations) && iterations <= passwordHashIterations();
}

function derivePassword(password: string, salt: Uint8Array, iterations: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, iterations, PASSWORD_BYTES, "sha256", (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string; iterations: number }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iterations = passwordHashIterations();
  const hash = await derivePassword(password, saltBytes, iterations);
  return { hash: hash.toString("hex"), salt: Buffer.from(saltBytes).toString("hex"), iterations };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string,
  iterations: number,
): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(storedHash) || !/^[a-f0-9]{32}$/.test(storedSalt)
    || !passwordIterationsSupported(iterations)) return false;
  const expected = Buffer.from(storedHash, "hex");
  const salt = Buffer.from(storedSalt, "hex");
  const candidate = await derivePassword(password, salt, iterations);
  return timingSafeEqual(expected, candidate);
}
