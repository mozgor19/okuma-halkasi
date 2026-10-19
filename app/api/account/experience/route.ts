import { accountExperienceAvailable, changeDeletionRequest, readAccountExperience, saveAccountTour } from "@/db/account-experience";
import { noStore, ReadingGroupError, requireAccountIdentity } from "@/lib/groups";
import { jsonBody, rateLimit, sameOrigin, selfServiceEnabled } from "@/lib/onboarding-security";

export const runtime = "edge";

function requireEnabled() {
  // Data rights must not depend on email provider availability or OAuth expiry.
  if (!selfServiceEnabled()) throw new ReadingGroupError("NOT_FOUND", 404, "Sayfa bulunamadı.");
}
function failed(error: unknown) {
  const known = error instanceof ReadingGroupError;
  const response = noStore(Response.json({ error: known ? error.message : "Hesap işlemi tamamlanamadı. Daha sonra yeniden dene.", code: known ? error.code : "SERVICE_UNAVAILABLE" }, { status: known ? error.status : 503 }));
  if (response.status === 429) response.headers.set("Retry-After", "900");
  return response;
}
export async function GET(request: Request) {
  try {
    requireEnabled();
    const identity = await requireAccountIdentity(request);
    return noStore(Response.json(await readAccountExperience(identity.memberId)));
  } catch (error) { return failed(error); }
}
export async function POST(request: Request) {
  try {
    requireEnabled(); sameOrigin(request);
    const identity = await requireAccountIdentity(request);
    await rateLimit(request, "account-experience", 40, 900, String(identity.memberId));
    const body = await jsonBody(request);
    if (!await accountExperienceAvailable()) throw new ReadingGroupError("ACCOUNT_TOOLS_UNAVAILABLE", 503, "Hesap araçları henüz kullanıma açılmadı. Destekle iletişime geç.");
    if (body.kind === "tour") return noStore(Response.json(await saveAccountTour(identity.memberId, body)));
    if (body.kind === "deletion") {
      await rateLimit(request, "account-deletion-password", 5, 3600, String(identity.memberId));
      return noStore(Response.json(await changeDeletionRequest(identity, body)));
    }
    throw new ReadingGroupError("INVALID_REQUEST", 400, "Geçersiz hesap işlemi.");
  } catch (error) { return failed(error); }
}
