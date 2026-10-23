export const LOCAL_FACE_VERSION = "human-3.3.6-local-v1";
export const LOCAL_FACE_CONSENT = "local-face-2026-10-22";
export const LOCAL_FACE_TTL = 30 * 86400000;
export type LocalFaceScope = { groupId: string; ownerId: number };
export type LocalFaceReference = { memberId: number; embeddings: number[][]; createdAt: number; consent: string };
export const localFaceScopeKey = (scope: LocalFaceScope) => {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(scope.groupId) || !Number.isSafeInteger(scope.ownerId) || scope.ownerId < 1) throw Error("Yerel grup kimliği geçersiz.");
  return JSON.stringify([LOCAL_FACE_VERSION, scope.groupId, scope.ownerId]);
};
export function validLocalEmbedding(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 1024 && value.every(n => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 100);
}
export function validLocalReference(value: LocalFaceReference, now = Date.now()) {
  return value.consent === LOCAL_FACE_CONSENT && Number.isSafeInteger(value.memberId) && value.memberId > 0
    && Number.isSafeInteger(value.createdAt) && value.createdAt <= now && value.createdAt > now - LOCAL_FACE_TTL
    && value.embeddings.length >= 1 && value.embeddings.length <= 3 && value.embeddings.every(validLocalEmbedding);
}
export function localModelRequest(input: string, origin: string) {
  const url = new URL(input, origin);
  const allowed = /^(?:blazeface|facemesh|faceres)\.(?:json|bin)$/;
  if (url.origin !== origin || url.search || url.hash || !url.pathname.startsWith("/face-models/") || !allowed.test(url.pathname.slice(13))) throw Error("Yüz işçisinde ağ erişimi engellendi.");
  return url;
}
export function selectLocalMatches(faces: number[][], references: LocalFaceReference[], similarity: (a: number[], b: number[]) => number) {
  const candidates: Array<{ memberId: number; score: number; face: number }> = [];
  faces.forEach((face, index) => {
    if (!validLocalEmbedding(face)) return;
    const ranked = references.filter(ref => validLocalReference(ref)).map(ref => {
      const scores = ref.embeddings.map(embedding => similarity(face, embedding)).filter(Number.isFinite).sort((a, b) => b - a);
      return { memberId: ref.memberId, score: scores.length > 1 ? .75 * scores[0] + .25 * scores[1] : scores[0] || 0 };
    }).sort((a, b) => b.score - a.score);
    if (!ranked[0] || ranked[0].score < .67 || (ranked[1] && ranked[0].score - ranked[1].score < .09)) return;
    candidates.push({ ...ranked[0], face: index });
  });
  // A person claimed by two faces is ambiguous, not two votes for that person.
  return candidates.filter(candidate => candidates.filter(other => other.memberId === candidate.memberId).length === 1)
    .map(({ memberId, score }) => ({ memberId, score }));
}
