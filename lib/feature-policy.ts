import { env } from "cloudflare:workers";

// This flag controls the old SERVER reference store, never the local-only tool.
// Koru must not reopen the upload/read path, even with an old runtime flag.
export function faceRecognitionEnabled() {
  if (env.APPLICATION_BRAND === "Koru") return false;
  return env.FACE_RECOGNITION_ENABLED === "true"
    || (env.APPLICATION_BRAND !== "Koru" && env.FACE_RECOGNITION_ENABLED !== "false");
}
