import { gmailCredentials } from "@/lib/gmail-mail";
import { normalizeEmail, publicHttpsOrigin } from "@/lib/onboarding-policy";

export function accountMailConfiguration(source: Pick<Cloudflare.Env, "ACCOUNT_MAIL_PROVIDER" | "MAIL_FROM" | "RESEND_API_KEY" | "GMAIL_CREDENTIALS" | "STAGING_ENVIRONMENT" | "AUTH_PUBLIC_ORIGIN">) {
  const from = normalizeEmail(source.MAIL_FROM);
  if (!from) return null;
  const provider = source.ACCOUNT_MAIL_PROVIDER || "resend";
  if (provider === "resend") return source.RESEND_API_KEY ? { provider, from, apiKey: source.RESEND_API_KEY } as const : null;
  if (provider !== "gmail") return null;
  const credentials = gmailCredentials(source.GMAIL_CREDENTIALS, { sender: from, origin: publicHttpsOrigin(source.AUTH_PUBLIC_ORIGIN || ""), staging: source.STAGING_ENVIRONMENT === "true" });
  return credentials ? { provider, from, credentials } as const : null;
}
