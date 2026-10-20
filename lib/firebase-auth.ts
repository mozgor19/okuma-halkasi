import { env } from "cloudflare:workers";
import { firebaseConfiguration } from "@/lib/firebase-auth-policy";
import { firebaseClient, FirebaseError } from "@/lib/firebase-protocol";
import { ReadingGroupError } from "@/lib/groups";

export function requireFirebase(requestUrl?: string) {
  const config = firebaseConfiguration(env, requestUrl);
  if (!config) throw new ReadingGroupError("IDENTITY_UNAVAILABLE", 503, "Kimlik doğrulama hizmeti kullanılamıyor.");
  return config;
}
export function remoteFirebase() { return firebaseClient(requireFirebase()); }
export function firebaseOperationError(error: unknown): never {
  if (error instanceof ReadingGroupError) throw error;
  throw new ReadingGroupError("IDENTITY_UNAVAILABLE", 503, "Kimlik doğrulama hizmetine ulaşılamıyor. Biraz sonra yeniden dene.");
}
async function sealingKey() {
  const config = requireFirebase();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET!), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode(config.projectId), info: new TextEncoder().encode("koru-firebase-session-v1") },
    key, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function sealFirebase(value: object, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(context) }, await sealingKey(), new TextEncoder().encode(JSON.stringify(value)));
  return JSON.stringify({ iv: btoa(String.fromCharCode(...iv)), data: btoa(String.fromCharCode(...new Uint8Array(bytes))) });
}
export async function openFirebase(value: string, context: string): Promise<Record<string, unknown>> {
  const item = JSON.parse(value) as { iv: string; data: string };
  const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Uint8Array.from(atob(item.iv), (character) => character.charCodeAt(0)), additionalData: new TextEncoder().encode(context) },
    await sealingKey(), Uint8Array.from(atob(item.data), (character) => character.charCodeAt(0)));
  return JSON.parse(new TextDecoder().decode(bytes));
}
export const firebaseUnavailable = (error: unknown) => error instanceof FirebaseError && error.code === "UNAVAILABLE";
