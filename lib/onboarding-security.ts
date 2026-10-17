import { env } from "cloudflare:workers";
import { identityDatabase, readingGroupsEnabled } from "@/db/database";
import { ReadingGroupError } from "@/lib/groups";
import { loopback, normalizeEmail, publicHttpsOrigin, publicHttpsUrl } from "@/lib/onboarding-policy";

export function selfServiceEnabled() { return readingGroupsEnabled() && env.SELF_SERVICE_ENABLED === "true"; }
export function localMail(request: Request) { return env.SELF_SERVICE_LOCAL === "true" && loopback(new URL(request.url)); }

export function onboardingConfiguration(request: Request) {
  const local = localMail(request);
  const configured = local || (!!publicHttpsOrigin(env.AUTH_PUBLIC_ORIGIN || "") && !!env.RESEND_API_KEY && !!normalizeEmail(env.MAIL_FROM)
    && !!normalizeEmail(env.SUPPORT_EMAIL) && publicHttpsUrl(env.PRIVACY_POLICY_URL) && publicHttpsUrl(env.TERMS_URL) && !!env.TURNSTILE_SITE_KEY && !!env.TURNSTILE_SECRET_KEY);
  return {
    enabled: selfServiceEnabled(), ready: configured, local,
    brand: env.APPLICATION_BRAND || "Okuma Halkası",
    supportEmail: normalizeEmail(env.SUPPORT_EMAIL),
    privacyUrl: publicHttpsUrl(env.PRIVACY_POLICY_URL) ? env.PRIVACY_POLICY_URL! : null,
    termsUrl: publicHttpsUrl(env.TERMS_URL) ? env.TERMS_URL! : null,
    siteKey: local ? null : env.TURNSTILE_SITE_KEY || null,
  };
}

export function requireSelfService(request: Request) {
  if (!selfServiceEnabled()) throw new ReadingGroupError("NOT_FOUND", 404, "Sayfa bulunamadı.");
  if (!onboardingConfiguration(request).ready) throw new ReadingGroupError("ONBOARDING_UNAVAILABLE", 503, "Kayıt ve e-posta hizmeti henüz kullanıma açılmadı.");
  if (!localMail(request) && new URL(request.url).origin !== publicHttpsOrigin(env.AUTH_PUBLIC_ORIGIN || "")) throw new ReadingGroupError("INVALID_ORIGIN", 403, "Geçersiz istek kaynağı.");
}

export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ReadingGroupError("INVALID_ORIGIN", 403, "Geçersiz istek kaynağı.");
  }
}

export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ReadingGroupError("INVALID_BODY", 415, "JSON gerekli.");
  const reader = request.body?.getReader();
  if (!reader) throw new ReadingGroupError("INVALID_BODY", 400, "Geçersiz istek.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new ReadingGroupError("BODY_TOO_LARGE", 413, "İstek çok büyük."); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const result: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Invalid JSON object");
    return result as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ReadingGroupError) throw error;
    throw new ReadingGroupError("INVALID_BODY", 400, "Geçersiz istek.");
  } finally { reader.releaseLock(); }
}

export async function rateLimit(request: Request, scope: string, limit: number, seconds = 900, identity?: string) {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / seconds);
  // Only Cloudflare's trusted client-IP header is used remotely, never X-Forwarded-For.
  const subject = identity || (localMail(request) ? "loopback" : request.headers.get("cf-connecting-ip") || "unknown");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${scope}:${subject}:${bucket}`))), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const db = identityDatabase();
  const row = await db.prepare(`INSERT INTO security_rate_limits(key, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count`).bind(digest, (bucket + 1) * seconds).first<{ count: number }>();
  await db.prepare("DELETE FROM security_rate_limits WHERE expires_at < ?").bind(now - 3600).run();
  if (!row || row.count > limit) throw new ReadingGroupError("RATE_LIMITED", 429, "Çok fazla deneme. Bir süre sonra tekrar dene.");
}

export async function verifyChallenge(request: Request, value: unknown, action: string) {
  if (localMail(request)) return;
  if (typeof value !== "string" || !value || value.length > 2048) throw new ReadingGroupError("CHALLENGE_REQUIRED", 400, "Güvenlik doğrulamasını tamamla.");
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8_000),
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: value, remoteip: request.headers.get("cf-connecting-ip") || undefined }),
  });
  const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
  if (!response.ok || !result.success || result.hostname !== new URL(env.AUTH_PUBLIC_ORIGIN!).hostname || result.action !== action) {
    throw new ReadingGroupError("CHALLENGE_FAILED", 400, "Güvenlik doğrulaması geçersiz. Yeniden dene.");
  }
}
