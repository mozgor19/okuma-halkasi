import { env } from "cloudflare:workers";

// Preserve the historical app, but never opt Koru into biometric processing
// because an operator forgot a flag. Public release policy also requires false.
export function faceRecognitionEnabled() {
  return env.FACE_RECOGNITION_ENABLED === "true"
    || (env.APPLICATION_BRAND !== "Koru" && env.FACE_RECOGNITION_ENABLED !== "false");
}
