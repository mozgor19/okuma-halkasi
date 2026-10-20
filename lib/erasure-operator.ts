import { timingSafeEqual } from "node:crypto";
import { ReadingGroupError } from "@/lib/groups";

type Settings = { AUTH_PUBLIC_ORIGIN?: string; ERASURE_OPERATOR_SECRET?: string; MAINTENANCE_MODE?: string };
export function requireErasureOperator(request: Request, source: Settings) {
  const secret = source.ERASURE_OPERATOR_SECRET;
  const supplied = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (source.AUTH_PUBLIC_ORIGIN !== "https://birkoru.com" || new URL(request.url).origin !== source.AUTH_PUBLIC_ORIGIN
    || !secret || !/^[a-f0-9]{64}$/.test(secret) || !supplied
    || !timingSafeEqual(Buffer.from(secret, "hex"), Buffer.from(supplied, "hex"))) throw new ReadingGroupError("NOT_FOUND", 404, "Sayfa bulunamadı.");
  const origin = request.headers.get("origin");
  if ((origin && origin !== source.AUTH_PUBLIC_ORIGIN) || request.headers.get("sec-fetch-site") === "cross-site") throw new ReadingGroupError("INVALID_ORIGIN", 403, "Geçersiz istek kaynağı.");
}
export function requireErasureMaintenance(source: Settings) {
  if (source.MAINTENANCE_MODE !== "true") throw new ReadingGroupError("MAINTENANCE_REQUIRED", 409, "Silme işlemi için bakım modu ve yazıcıların durdurulması gerekli.");
}

export function erasureBindings(source: Record<string, unknown>) {
  let names: unknown;
  try { names = JSON.parse(typeof source.READING_GROUP_DB_BINDINGS === "string" ? source.READING_GROUP_DB_BINDINGS : "[]"); }
  catch { throw Error("ERASURE_BINDING_MISMATCH"); }
  if (!Array.isArray(names) || names.some((name) => typeof name !== "string" || !/^[A-Z][A-Z0-9_]{0,63}$/.test(name) || name === "DB")
    || new Set(names).size !== names.length) throw Error("ERASURE_BINDING_MISMATCH");
  return Object.fromEntries(["DB", ...names].map((name) => [name, source[name] as D1Database]));
}
