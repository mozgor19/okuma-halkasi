import { LOCAL_FACE_TTL, localFaceScopeKey, validLocalReference, type LocalFaceReference, type LocalFaceScope } from "@/lib/local-face-policy";
type Record = { id: string; createdAt: number; expiresAt: number; iv: ArrayBuffer; data: ArrayBuffer };
const encode = new TextEncoder();
let opening: Promise<IDBDatabase> | undefined;
function database() {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("koru-local-faces-v1", 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("references", { keyPath: "id" }); request.result.createObjectStore("keys"); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = undefined; reject(Error("Yerel yüz kasası açılamadı.")); };
    request.onblocked = () => reject(Error("Yerel yüz kasası başka bir pencerede kullanılıyor."));
  });
  return opening;
}
async function operation<T>(store: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode), request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(Error("Yerel yüz kasası işlemi tamamlanamadı."));
  });
}
const range = (scope: LocalFaceScope) => IDBKeyRange.bound(localFaceScopeKey(scope) + ":", localFaceScopeKey(scope) + ":\uffff");
const aad = (record: Pick<Record, "id" | "createdAt" | "expiresAt">) => encode.encode(JSON.stringify([record.id, record.createdAt, record.expiresAt]));
async function keyFor(scope: LocalFaceScope) {
  const id = localFaceScopeKey(scope);
  let key = await operation<CryptoKey | undefined>("keys", "readonly", store => store.get(id));
  if (!key) {
    key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    // add(), not put(): another tab must never replace a key already in use.
    try { await operation("keys", "readwrite", store => store.add(key!, id)); }
    catch { key = await operation<CryptoKey>("keys", "readonly", store => store.get(id)); }
  }
  if (!key || key.extractable || key.algorithm.name !== "AES-GCM") throw Error("Yerel yüz anahtarı kullanılamıyor.");
  return key;
}
export async function readLocalReferences(scope: LocalFaceScope) {
  const records = await operation<Record[]>("references", "readonly", store => store.getAll(range(scope)));
  if (!records.length) return [];
  const key = await operation<CryptoKey | undefined>("keys", "readonly", store => store.get(localFaceScopeKey(scope)));
  if (!key) throw Error("Yerel kayıt anahtarı bulunamadı. Bu grubun yerel yüz verilerini temizle.");
  const refs: LocalFaceReference[] = [];
  for (const record of records) {
    if (record.expiresAt <= Date.now()) { await operation("references", "readwrite", store => store.delete(record.id)); continue; }
    try {
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: record.iv, additionalData: aad(record) }, key, record.data);
      const reference = JSON.parse(new TextDecoder().decode(plain)) as LocalFaceReference;
      if (!validLocalReference(reference) || record.id !== localFaceScopeKey(scope) + ":" + reference.memberId
        || reference.createdAt !== record.createdAt || record.expiresAt !== record.createdAt + LOCAL_FACE_TTL) throw Error();
      refs.push(reference);
    } catch { throw Error("Yerel yüz kaydı doğrulanamadı. Bu grubun yerel yüz verilerini temizle."); }
  }
  return refs;
}
export async function saveLocalReference(scope: LocalFaceScope, reference: LocalFaceReference) {
  if (!validLocalReference(reference)) throw Error("Yüz referansı geçersiz.");
  const refs = await readLocalReferences(scope);
  if (refs.length >= 100 && !refs.some(ref => ref.memberId === reference.memberId)) throw Error("Bu cihazda grup başına en fazla 100 referans tutulabilir.");
  const key = await keyFor(scope), iv = crypto.getRandomValues(new Uint8Array(12));
  const header = { id: localFaceScopeKey(scope) + ":" + reference.memberId, createdAt: reference.createdAt, expiresAt: reference.createdAt + LOCAL_FACE_TTL };
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(header) }, key, encode.encode(JSON.stringify(reference)));
  await operation("references", "readwrite", store => store.put({ ...header, iv: iv.buffer, data }));
}
export async function clearLocalReferences(scope: LocalFaceScope, memberId?: number) {
  if (memberId !== undefined) {
    if (!Number.isSafeInteger(memberId) || memberId < 1) throw Error("Kişi geçersiz.");
    await operation("references", "readwrite", store => store.delete(localFaceScopeKey(scope) + ":" + memberId));
  } else {
    await operation("references", "readwrite", store => store.delete(range(scope)));
    await operation("keys", "readwrite", store => store.delete(localFaceScopeKey(scope)));
  }
}
