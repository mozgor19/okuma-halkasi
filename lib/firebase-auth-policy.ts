export const FIREBASE_PROJECT = "koru-951bf";
export const FIREBASE_PROJECT_NUMBER = "605673770248";
export const FIREBASE_MANAGED_PASSWORD = "managed:firebase-v1";
export type FirebaseAuthEnv = {
  AUTH_PROVIDER?: string; FIREBASE_API_KEY?: string; FIREBASE_PROJECT_ID?: string;
  AUTH_PUBLIC_ORIGIN?: string; SESSION_SECRET?: string; SELF_SERVICE_LOCAL?: string;
  SELF_SERVICE_ENABLED?: string; READING_GROUPS_ENABLED?: string; STAGING_ENVIRONMENT?: string;
  FIREBASE_LOCAL_EMULATOR_ORIGIN?: string;
};

export function firebaseSelected(source: FirebaseAuthEnv) { return source.AUTH_PROVIDER === "firebase"; }
export function validFirebaseActionCode(value: unknown): value is string {
  return typeof value === "string" && value.length >= 10 && value.length <= 2048 && /^[\x21-\x7e]+$/.test(value);
}
export function firebaseConfiguration(source: FirebaseAuthEnv, requestUrl?: string) {
  if (!firebaseSelected(source) || source.FIREBASE_PROJECT_ID !== FIREBASE_PROJECT
    || !/^AIza[A-Za-z0-9_-]{35}$/.test(source.FIREBASE_API_KEY || "") || !source.SESSION_SECRET || source.SESSION_SECRET.length < 32
    || source.SELF_SERVICE_LOCAL === "true" || source.FIREBASE_LOCAL_EMULATOR_ORIGIN
    || source.SELF_SERVICE_ENABLED !== "true" || source.READING_GROUPS_ENABLED !== "true") return null;
  const applicationOrigin = source.AUTH_PUBLIC_ORIGIN;
  const canary = applicationOrigin === "https://koru-auth-canary.mustafayapayzeka.workers.dev" && source.STAGING_ENVIRONMENT === "true";
  if (applicationOrigin !== "https://birkoru.com" && !canary) return null;
  if (!canary && source.STAGING_ENVIRONMENT === "true") return null;
  if (requestUrl !== undefined) {
    try { if (new URL(requestUrl).origin !== applicationOrigin) return null; } catch { return null; }
  }
  return { projectId: FIREBASE_PROJECT, projectNumber: FIREBASE_PROJECT_NUMBER, apiKey: source.FIREBASE_API_KEY!, applicationOrigin };
}
