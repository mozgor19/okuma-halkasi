import { identityDatabase } from "@/db/database";
import { linkAccountEmail, registerAccount, requestRecovery, resetAccountPassword, verifyEmail } from "@/db/onboarding-accounts";
import { createReadingGroup, joinReadingGroup, manageInvitations } from "@/db/onboarding-groups";
import { noStore, ReadingGroupError, requireAccountIdentity } from "@/lib/groups";
import { normalizeEmail } from "@/lib/onboarding-policy";
import { jsonBody, localMail, onboardingConfiguration, rateLimit, requireSelfService, sameOrigin, verifyChallenge } from "@/lib/onboarding-security";

export const runtime = "edge";
type Context = { params: Promise<{ action: string }> };

function failed(error: unknown) {
  const response = noStore(Response.json({ error: error instanceof ReadingGroupError ? error.message : "İşlem şu anda tamamlanamıyor. Daha sonra tekrar dene.", code: error instanceof ReadingGroupError ? error.code : "SERVICE_UNAVAILABLE" }, { status: error instanceof ReadingGroupError ? error.status : 503 }));
  if (response.status === 429) response.headers.set("Retry-After", "900");
  // Never log credentials, tokens, email bodies or SQL parameter values.
  if (!(error instanceof ReadingGroupError)) console.error("Onboarding service operation failed");
  return response;
}

export async function GET(request: Request, context: Context) {
  const { action } = await context.params;
  if (action === "config") return noStore(Response.json(onboardingConfiguration(request)));
  try {
    requireSelfService(request);
    const account = await requireAccountIdentity(request);
    if (action === "account") {
      const profile = await identityDatabase().prepare(`SELECT a.username, m.name, p.email FROM member_accounts a
        JOIN members m ON m.id = a.member_id LEFT JOIN account_profiles p ON p.member_id = a.member_id
        WHERE a.member_id = ?`).bind(account.memberId).first<{ username: string; name: string; email: string | null }>();
      if (!profile) throw new ReadingGroupError("UNAUTHORIZED", 401, "Oturum gerekli.");
      return noStore(Response.json({ ...profile, verified: !!profile.email }));
    }
    if (action === "invitations") return noStore(Response.json(await manageInvitations(request, "list")));
    throw new ReadingGroupError("NOT_FOUND", 404, "Sayfa bulunamadı.");
  } catch (error) { return failed(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    requireSelfService(request);
    sameOrigin(request);
    const { action } = await context.params;
    await rateLimit(request, "onboarding-ip", 100);
    const body = await jsonBody(request);
    if (["register", "forgot-password"].includes(action)) {
      await rateLimit(request, action + "-ip", 15);
      await rateLimit(request, action + "-email", 5, 3600, normalizeEmail(body.email) || "invalid");
      await verifyChallenge(request, body.challenge, action);
      const started = Date.now();
      const result = action === "register" ? await registerAccount(request, body) : await requestRecovery(request, body.email);
      if (!localMail(request)) await new Promise((resolve) => setTimeout(resolve, Math.max(0, 500 - (Date.now() - started))));
      return noStore(Response.json(result));
    }
    if (action === "verify-email") return noStore(Response.json(await verifyEmail(body.token)));
    if (action === "reset-password") return noStore(Response.json(await resetAccountPassword(body.token, body.password)));
    const account = await requireAccountIdentity(request);
    await rateLimit(request, "account-onboarding", 40, 900, String(account.memberId));
    if (action === "link-email") {
      await rateLimit(request, "link-email", 5, 3600, String(account.memberId));
      return noStore(Response.json(await linkAccountEmail(request, account.memberId, body)));
    }
    if (action === "create-group") {
      await rateLimit(request, "create-group", 10, 3600, String(account.memberId));
      return noStore(Response.json(await createReadingGroup(account.memberId, body)));
    }
    if (action === "join-group") return noStore(Response.json(await joinReadingGroup(account.memberId, body.token)));
    if (action === "invitations" || action === "revoke-invitation") return noStore(Response.json(await manageInvitations(request, action === "invitations" ? "create" : "revoke", body)));
    throw new ReadingGroupError("NOT_FOUND", 404, "Sayfa bulunamadı.");
  } catch (error) { return failed(error); }
}
