import { env } from "cloudflare:workers";
import { after } from "next/server";
import { identityDatabase } from "@/db/database";
import { localMail, requireTestEmail } from "@/lib/onboarding-security";
import { normalizeEmail, publicHttpsOrigin, tokenHash } from "@/lib/onboarding-policy";
import { accountMailConfiguration } from "@/lib/mail-configuration";
import { GmailDeliveryError, sendGmailMail } from "@/lib/gmail-mail";

export async function deliverAccountMail(request: Request, recipient: string, purpose: "verify" | "reset", token: string) {
  requireTestEmail(recipient);
  if (localMail(request)) return sendAccountMail(request, recipient, purpose, token);
  // Keep provider latency and account existence out of the public response timing.
  // vinext forwards after() work to the Worker's request ExecutionContext.waitUntil.
  after(async () => {
    let diagnostic = "provider";
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await sendAccountMail(request, recipient, purpose, token); console.info("Account email delivery accepted"); return; }
      catch (error) {
        if (error instanceof GmailDeliveryError) diagnostic = `gmail phase=${error.phase} status=${error.status ?? "network"} reason=${error.reason}`;
        if (error instanceof GmailDeliveryError && !error.retryable) break;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    console.error("Account email delivery failed", diagnostic);
  });
}

export async function sendAccountMail(request: Request, recipient: string, purpose: "verify" | "reset", token: string) {
  requireTestEmail(recipient);
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
  const provider = accountMailConfiguration(env);
  const to = normalizeEmail(recipient), replyTo = normalizeEmail(env.SUPPORT_EMAIL);
  if (!provider || !to || !replyTo) throw new Error("Account email provider is not configured.");
  if (provider.provider === "gmail") {
    await sendGmailMail(provider.credentials, { recipient: to, replyTo, subject, text: body });
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", redirect: "manual", signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `${purpose}-${await tokenHash(token)}` },
    body: JSON.stringify({ from: provider.from, to: [to], reply_to: replyTo, subject, text: body }),
  });
  if (!response.ok) throw new Error("Account email delivery failed.");
}
