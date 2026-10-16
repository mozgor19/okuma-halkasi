import { resolve } from "node:path";

export const testRunId = process.env.OKUMA_TEST_RUN_ID || "";
if (testRunId && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(testRunId)) throw new Error("Invalid isolated test run ID.");
const runtime = testRunId ? `.sites-runtime/release-tests/${testRunId}` : ".sites-runtime";
export const groupsSettingsPath = resolve(`${runtime}/groups-development.json`);
export const groupsConfigPath = resolve(`${runtime}/groups-development/wrangler.json`);
export const groupsSeedPath = resolve(`${runtime}/groups-development/seeded`);
export const groupsStatePath = resolve(testRunId ? `${runtime}/state` : ".wrangler/groups-development");

export function loopbackOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Tests require an HTTP loopback origin without credentials or a path.");
  }
  return url.origin;
}
export const testOrigin = loopbackOrigin(process.env.OKUMA_TEST_ORIGIN || `http://127.0.0.1:${testRunId ? 5184 : 5174}`);
export const legacyOrigin = loopbackOrigin(process.env.OKUMA_LEGACY_ORIGIN || `http://127.0.0.1:${testRunId ? 5185 : 5175}`);
if (testOrigin === legacyOrigin) throw new Error("Main and legacy test origins must differ.");
export const testAndroidPackage = process.env.OKUMA_ANDROID_PACKAGE || "com.okumahalkasi.app";
export const testOutputRoot = testRunId ? `outputs/release-tests/${testRunId}` : "outputs";
export function testOutputPath(name) { return `${testOutputRoot}/${name}`; }
