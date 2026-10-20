import { FIREBASE_PROJECT } from "@/lib/firebase-auth-policy";
import { readFirebaseJson } from "@/lib/firebase-protocol";

export function firebaseErasureAdmin(accessToken: string, request: typeof fetch = fetch) {
  if (typeof accessToken !== "string" || !/^[\x21-\x7e]{20,4096}$/.test(accessToken) || accessToken.startsWith("AIza")) throw Error("ERASURE_PROVIDER_AUTH_REQUIRED");
  async function api(operation: "lookup" | "delete", uid: string) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw Error("ERASURE_PROVIDER_ID_INVALID");
    const url = new URL(`https://identitytoolkit.googleapis.com/v1/projects/${FIREBASE_PROJECT}/accounts:${operation}`);
    if (operation === "lookup") url.searchParams.set("fields", "users(localId,tenantId)");
    try {
      const response = await request(url.href, { method: "POST", redirect: "manual", credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ localId: operation === "lookup" ? [uid] : uid }) });
      if (response.status !== 200) { await response.body?.cancel(); throw Error(); }
      return await readFirebaseJson(response);
    } catch { throw Error("ERASURE_PROVIDER_UNAVAILABLE"); }
  }
  async function present(uid: string) {
    const data = await api("lookup", uid), users = data.users ?? [];
    if (!Array.isArray(users) || users.length > 1 || users.some((user) => !user || user.localId !== uid || user.tenantId !== undefined)) throw Error("ERASURE_PROVIDER_RESPONSE_INVALID");
    return users.length === 1;
  }
  return { async erase(uid: string) {
    if (!await present(uid)) return;
    // A lost delete response is reconciled by an authoritative UID lookup,
    // never by assuming success or automatically repeating a write.
    try { await api("delete", uid); }
    catch { if (!await present(uid)) return; throw Error("ERASURE_PROVIDER_DELETE_UNCONFIRMED"); }
    if (await present(uid)) throw Error("ERASURE_PROVIDER_DELETE_UNCONFIRMED");
  } };
}
