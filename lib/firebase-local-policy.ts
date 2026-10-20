export const FIREBASE_LOCAL_PROJECT = "demo-koru-auth-local";
// The pinned Auth Emulator uses this synthetic project number for token refresh.
export const FIREBASE_LOCAL_PROJECT_NUMBER = "12345";
export const FIREBASE_MANAGED_HASH = "managed:firebase-local";
export type FirebaseLocalEnv = {
  AUTH_PROVIDER?: string; FIREBASE_LOCAL_EMULATOR_ORIGIN?: string; AUTH_PUBLIC_ORIGIN?: string;
  SELF_SERVICE_LOCAL?: string; SELF_SERVICE_ENABLED?: string; READING_GROUPS_ENABLED?: string; SESSION_SECRET?: string;
};
function origin(value: string | undefined): string | null {
  try {
    const url = new URL(value || "");
    return url.protocol === "http:" && url.hostname === "127.0.0.1" && Number(url.port) >= 1024 && Number(url.port) <= 65535
      && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash ? url.origin : null;
  } catch { return null; }
}
export function firebaseLocalSelected(source: FirebaseLocalEnv) { return source.AUTH_PROVIDER !== undefined && source.AUTH_PROVIDER !== "firebase"; }
export function firebaseLocalConfiguration(source: FirebaseLocalEnv, requestUrl?: string) {
  if (source.AUTH_PROVIDER !== "firebase-local" || source.SELF_SERVICE_LOCAL !== "true" || source.SELF_SERVICE_ENABLED !== "true"
    || source.READING_GROUPS_ENABLED !== "true" || !source.SESSION_SECRET || source.SESSION_SECRET.length < 32) return null;
  const applicationOrigin = origin(source.AUTH_PUBLIC_ORIGIN), emulatorOrigin = origin(source.FIREBASE_LOCAL_EMULATOR_ORIGIN);
  if (!applicationOrigin || !emulatorOrigin || applicationOrigin === emulatorOrigin) return null;
  if (requestUrl !== undefined) {
    try { if (new URL(requestUrl).origin !== applicationOrigin || origin(new URL(requestUrl).origin) !== applicationOrigin) return null; }
    catch { return null; }
  }
  return { applicationOrigin, emulatorOrigin, projectId: FIREBASE_LOCAL_PROJECT };
}
export function syntheticFirebaseEmail(email: string) { return /\.(?:test|invalid)$/.test(email); }
