import { env } from "cloudflare:workers";
import { identityDatabase } from "@/db/database";
import { accountErasureService } from "@/db/account-erasure";
import { firebaseErasureCoordinator } from "@/db/firebase-erasure";
import { firebaseErasureAdmin } from "@/lib/firebase-admin-erasure";
import { erasureBindings, requireErasureMaintenance, requireErasureOperator } from "@/lib/erasure-operator";
import { jsonBody, rateLimit } from "@/lib/onboarding-security";
import { noStore, ReadingGroupError } from "@/lib/groups";

export const runtime = "edge";
export async function POST(request: Request) {
  try {
    requireErasureOperator(request, env);
    const body = await jsonBody(request), db = identityDatabase();
    await rateLimit(request, "erasure-operator", 60, 900, "operator");
    if (body.action === "queue") {
      const rows = await db.prepare("SELECT id AS requestId,status,requested_at AS requestedAt FROM account_deletion_requests WHERE status IN ('requested','processing') ORDER BY requested_at LIMIT 100").all();
      return noStore(Response.json({ requests: rows.results }));
    }
    if (typeof body.requestId !== "string" || !["inspect", "execute"].includes(String(body.action))) throw new ReadingGroupError("INVALID_REQUEST", 400, "Geçersiz işletim isteği.");
    const transfers = body.transfers ?? {};
    if (!transfers || typeof transfers !== "object" || Array.isArray(transfers)
      || Object.entries(transfers).some(([group, member]) => !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(group) || !Number.isSafeInteger(member) || Number(member) <= 0)) throw new ReadingGroupError("INVALID_REQUEST", 400, "Yönetici devrini kontrol et.");
    if (body.action === "execute") {
      requireErasureMaintenance(env);
      if (body.writersStopped !== true || body.contentReviewComplete !== true || typeof body.expectedDigest !== "string" || typeof body.confirmation !== "string") throw new ReadingGroupError("REVIEW_REQUIRED", 409, "Silme planı ve içerik incelemesi gerekli.");
    }
    const provider = typeof body.providerAccessToken === "string" ? firebaseErasureAdmin(body.providerAccessToken) : undefined;
    const coordinator = firebaseErasureCoordinator(db, provider, body.action === "execute");
    const service = accountErasureService(db, erasureBindings(env as unknown as Record<string, unknown>), coordinator, { incremental: true });
    if (body.action === "inspect") return noStore(Response.json(await service.inspect(body.requestId, transfers as Record<string, number>)));
    const result = await service.execute(body.requestId, { expectedDigest: body.expectedDigest as string, confirmation: body.confirmation as string,
      writersStopped: true, contentReviewComplete: true, transfers: transfers as Record<string, number> });
    return noStore(Response.json(result));
  } catch (error) {
    const known = error instanceof ReadingGroupError;
    // Request/response logs must not include operator/provider credentials or UID lists.
    return noStore(Response.json({ code: known ? error.code : "ERASURE_STOPPED", error: known ? error.message : "Silme işlemi durdu. Veri silinmiş kabul edilmez; işletici kontrolü gerekli." }, { status: known ? error.status : 503 }));
  }
}
