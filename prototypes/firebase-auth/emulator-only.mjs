import { DEMO_PROJECT } from "./identity-contract.mjs";

// Keep unsigned emulator handling outside the signed-token candidate module.
export function requireLocalEmulator(environment = process.env) {
  if (environment.GCLOUD_PROJECT !== DEMO_PROJECT
    || !/^127\.0\.0\.1:[1-9][0-9]{3,4}$/.test(environment.FIREBASE_AUTH_EMULATOR_HOST ?? "")
    || Number(environment.FIREBASE_AUTH_EMULATOR_HOST.split(":")[1]) > 65535
    || environment.KORU_FIREBASE_LOCAL_ONLY !== "true"
    || environment.GOOGLE_APPLICATION_CREDENTIALS || environment.FIREBASE_TOKEN) {
    throw Error("LOCAL_DEMO_EMULATOR_REQUIRED");
  }
  return { projectId: DEMO_PROJECT, host: environment.FIREBASE_AUTH_EMULATOR_HOST };
}
