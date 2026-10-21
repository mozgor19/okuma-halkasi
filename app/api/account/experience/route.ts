import { accountExperienceAvailable, changeDeletionRequest, readAccountExperience, saveAccountTour } from "@/db/account-experience";
import { noStore, ReadingGroupError, requireAccountIdentity, resolveReadingGroup } from "@/lib/groups";
import { jsonBody, rateLimit, sameOrigin, selfServiceEnabled } from "@/lib/onboarding-security";
import { saveAccountAppearance } from "@/db/account-appearance";

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
    if (body.kind === "appearance") {
      let group = null;
      if (body.groupId !== undefined) {
        if (typeof body.groupId !== "string" || !body.groupId || body.groupId.length > 128) throw new ReadingGroupError("INVALID_APPEARANCE", 400, "Okuma grubunu kontrol et.");
        const selected = await resolveReadingGroup(request);
        if (selected.context.accountMemberId !== identity.memberId || selected.group.id !== body.groupId) {
          throw new ReadingGroupError("GROUP_CHANGED", 409, "Okuma grubu değişti. Sayfayı yenile.");
        }
        group = selected.group;
      }
      await saveAccountAppearance(identity, body, group?.id ?? null);
      return noStore(Response.json({ ...await readAccountExperience(identity.memberId),
        ...(group ? { group: { ...group, scheme: body.scheme, mode: body.mode } } : {}) }));
    }
    if (body.kind === "deletion") {
      await rateLimit(request, "account-deletion-password", 5, 3600, String(identity.memberId));
      return noStore(Response.json(await changeDeletionRequest(identity, body)));
    }
    throw new ReadingGroupError("INVALID_REQUEST", 400, "Geçersiz hesap işlemi.");
  } catch (error) { return failed(error); }
}
