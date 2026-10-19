export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
// Three attempts, two requests each, plus 1s/2s backoff stay below waitUntil's 30s.
export const GMAIL_REQUEST_TIMEOUT_MS = 4000;
export type GmailCredentials = {
  environment: "koru-staging";
  origin: string;
  intendedSender: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  scope: typeof GMAIL_SEND_SCOPE;
  authorizedAt: string;
  expiresAt: string;
};

export class GmailDeliveryError extends Error {
  readonly retryable: boolean;
  readonly phase: "mime" | "refresh" | "send";
  readonly status: number | null;
  readonly reason: "http" | "response" | "invocation" | "timeout" | "aborted" | "context" | "network";
  constructor(retryable = false, phase: "mime" | "refresh" | "send" = "mime", status: number | null = null,
    reason: GmailDeliveryError["reason"] = status === null ? "network" : "http") {
    super("Gmail email delivery failed."); this.retryable = retryable; this.phase = phase; this.status = status; this.reason = reason;
  }
}

function transportFailure(error: unknown, phase: "refresh" | "send", retryable: boolean) {
  if (error instanceof GmailDeliveryError) return error;
  const exception = error instanceof Error || error instanceof DOMException ? error : null;
  const reason = exception && /illegal invocation/i.test(exception.message) ? "invocation"
    : exception && /different request|request context/i.test(exception.message) ? "context"
    : exception?.name === "TimeoutError" ? "timeout"
    : exception?.name === "AbortError" ? "aborted"
    : error instanceof SyntaxError ? "response" : "network";
  return new GmailDeliveryError(retryable, phase, null, reason);
}

export function gmailCredentials(value: string | undefined, expected: { origin: string | null; sender: string | null; staging: boolean }, now = Date.now()): GmailCredentials | null {
  try {
    const data = JSON.parse(value || "null");
    if (!data || !expected.staging || data.environment !== "koru-staging" || !expected.origin || data.origin !== expected.origin
      || !expected.sender || data.intendedSender !== expected.sender || data.scope !== GMAIL_SEND_SCOPE
      || typeof data.clientId !== "string" || !/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(data.clientId)
      || typeof data.clientSecret !== "string" || !data.clientSecret.trim() || data.clientSecret.length > 512 || /[\r\n]/.test(data.clientSecret)
      || typeof data.refreshToken !== "string" || !data.refreshToken.trim() || data.refreshToken.length > 8192 || /[\r\n]/.test(data.refreshToken)
      || typeof data.authorizedAt !== "string" || typeof data.expiresAt !== "string") return null;
    const issued = Date.parse(data.authorizedAt), expires = Date.parse(data.expiresAt);
    if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > now + 300_000 || expires <= now || expires <= issued || expires > issued + 7 * 86_400_000) return null;
    return { environment: data.environment, origin: data.origin, intendedSender: data.intendedSender, clientId: data.clientId,
      clientSecret: data.clientSecret, refreshToken: data.refreshToken, scope: GMAIL_SEND_SCOPE, authorizedAt: data.authorizedAt, expiresAt: data.expiresAt };
  } catch { return null; }
}

type Mail = { recipient: string; replyTo: string; subject: string; text: string };

export async function sendGmailMail(credentials: GmailCredentials, mail: Mail, fetcher: typeof fetch = fetch): Promise<string> {
  let raw: string;
  try {
    const expires = Date.parse(credentials.expiresAt);
    if (!Number.isFinite(expires) || expires <= Date.now() || mail.subject.length > 300 || /[\r\n\0]/.test(mail.subject) || mail.text.length > 65_536) throw new Error();
    for (const address of [credentials.intendedSender, mail.recipient, mail.replyTo]) {
      if (!/^[^\s<>,;:@]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/.test(address)) throw new Error();
    }
    const { createMimeMessage, Mailbox } = await import("mimetext/browser");
    const message = createMimeMessage();
    message.setSender({ addr: credentials.intendedSender });
    message.setRecipient({ addr: mail.recipient });
    message.setHeader("Reply-To", new Mailbox({ addr: mail.replyTo }));
    message.setSubject(mail.subject);
    const encodedText = message.toBase64(mail.text).match(/.{1,76}/g)?.join("\r\n") || "";
    message.addMessage({ contentType: "text/plain", encoding: "base64", data: encodedText });
    raw = message.asEncoded();
  } catch { throw new GmailDeliveryError(); }

  let accessToken: string;
  try {
    const response = await fetcher("https://oauth2.googleapis.com/token", {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(GMAIL_REQUEST_TIMEOUT_MS),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret, refresh_token: credentials.refreshToken, grant_type: "refresh_token" }),
    });
    if (!response.ok) throw new GmailDeliveryError(response.status === 429 || response.status >= 500, "refresh", response.status);
    const result = await response.json() as { access_token?: unknown; token_type?: unknown; scope?: unknown; expires_in?: unknown };
    if (typeof result.access_token !== "string" || !result.access_token || result.token_type !== "Bearer" || typeof result.expires_in !== "number" || result.expires_in <= 0
      || (result.scope !== undefined && result.scope !== GMAIL_SEND_SCOPE)) throw new GmailDeliveryError(false, "refresh", response.status);
    accessToken = result.access_token;
  } catch (error) { throw transportFailure(error, "refresh", true); }

  // A mailbox-specific userId prevents a token for another Google account sending as "me".
  // Gmail has no send idempotency key: an ambiguous send failure must not auto-repeat.
  try {
    const response = await fetcher(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(credentials.intendedSender)}/messages/send`, {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(GMAIL_REQUEST_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw }),
    });
    if (!response.ok) throw new GmailDeliveryError(response.status === 401, "send", response.status);
    const result = await response.json() as { id?: unknown };
    if (typeof result.id !== "string" || !result.id) throw new GmailDeliveryError(false, "send", response.status);
    return result.id;
  } catch (error) { throw transportFailure(error, "send", false); }
}
