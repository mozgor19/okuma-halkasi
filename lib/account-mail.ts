import { env } from "cloudflare:workers";
import { after } from "next/server";
import { identityDatabase } from "@/db/database";
import { localMail } from "@/lib/onboarding-security";
import { normalizeEmail, publicHttpsOrigin, tokenHash } from "@/lib/onboarding-policy";

export async function deliverAccountMail(request: Request, recipient: string, purpose: "verify" | "reset", token: string) {
  if (localMail(request)) return sendAccountMail(request, recipient, purpose, token);
  // Keep provider latency and account existence out of the public response timing.
  // vinext forwards after() work to the Worker's request ExecutionContext.waitUntil.
  after(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await sendAccountMail(request, recipient, purpose, token); return; }
      catch { if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1))); }
    }
    console.error("Account email delivery failed after retries");
  });
}

export async function sendAccountMail(request: Request, recipient: string, purpose: "verify" | "reset", token: string) {
  const origin = localMail(request) ? new URL(request.url).origin : publicHttpsOrigin(env.AUTH_PUBLIC_ORIGIN || "");
  if (!origin) throw new Error("Account email origin is not configured.");
  // Fragments do not reach HTTP access logs or Referer headers. GET never consumes a token.
  const url = `${origin}/${purpose === "verify" ? "verify-email" : "reset-password"}#token=${token}`;
  const brand = env.APPLICATION_BRAND || "Okuma Halkası";
  const subject = `${brand}: ${purpose === "verify" ? "E-posta adresini doğrula" : "Şifreni yenile"}`;
  const body = `${purpose === "verify" ? "Hesabını oluşturmak için" : "Şifreni yenilemek için"} bağlantıyı aç:\n\n${url}\n\nBağlantı ${purpose === "verify" ? "30" : "15"} dakika geçerlidir ve bir kez kullanılabilir. Bu işlemi sen başlatmadıysan e-postayı yok say.\n${env.SUPPORT_EMAIL || ""}`;
  if (localMail(request)) {
    const db = identityDatabase();
    await db.prepare("DELETE FROM development_mail WHERE expires_at < ?").bind(Date.now()).run();
    await db.prepare("INSERT INTO development_mail(id, recipient, subject, body, expires_at) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), recipient, subject, body, Date.now() + 30 * 60_000).run();
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `${purpose}-${await tokenHash(token)}` },
    body: JSON.stringify({ from: normalizeEmail(env.MAIL_FROM), to: [recipient], reply_to: normalizeEmail(env.SUPPORT_EMAIL), subject, text: body }),
  });
  if (!response.ok) throw new Error("Account email delivery failed.");
}
