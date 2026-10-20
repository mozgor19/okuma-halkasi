import { readProviderJson } from "./provider-http.mjs";

// Approved TEST resource identifiers only, never production identity or a key.
export const testProject = Object.freeze({
  projectId: "koru-auth-test",
  projectNumber: "1038145971577",
  authDomain: "koru-auth-test.firebaseapp.com",
  appId: "1:1038145971577:web:262fb6d97d63a64601fba8",
});

export function approvedTestConfig(value) {
  const keys = ["apiKey", "authDomain", "projectId", "appId"];
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key))
    || value.projectId !== testProject.projectId || value.authDomain !== testProject.authDomain
    || value.appId !== testProject.appId || typeof value.apiKey !== "string" || !/^AIza[A-Za-z0-9_-]{35}$/.test(value.apiKey))
    throw Error("FIREBASE_TEST_CONFIG_REJECTED");
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, value[key]])));
}

export async function preflightTestProject(input, { request = fetch, environment = process.env } = {}) {
  const config = approvedTestConfig(input);
  if (["FIREBASE_AUTH_EMULATOR_HOST", "GOOGLE_APPLICATION_CREDENTIALS", "FIREBASE_TOKEN", "CLOUDSDK_AUTH_ACCESS_TOKEN"].some((key) => environment[key]))
    throw Error("FIREBASE_TEST_CREDENTIAL_ENV_REJECTED");
  const url = new URL("https://identitytoolkit.googleapis.com/v1/projects");
  url.searchParams.set("key", config.apiKey);
  // The provider checks this app belongs to the API key's retrieved project.
  url.searchParams.set("firebaseAppId", config.appId);
  let response;
  try {
    response = await request(url.href, {
      method: "GET", redirect: "error", credentials: "omit", cache: "no-store",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, signal: AbortSignal.timeout(10000),
    });
  } catch { throw Error("FIREBASE_TEST_PREFLIGHT_NETWORK"); }
  if (!response.ok) {
    await response.body?.cancel();
    throw Error("FIREBASE_TEST_PREFLIGHT_HTTP_" + response.status);
  }
  let data;
  try { data = await readProviderJson(response); } catch { throw Error("FIREBASE_TEST_PREFLIGHT_RESPONSE"); }
  if (!data || ![testProject.projectId, testProject.projectNumber].includes(data.projectId)
    || !Array.isArray(data.authorizedDomains) || data.authorizedDomains.length > 100
    || !data.authorizedDomains.every((domain) => typeof domain === "string" && /^[a-zA-Z0-9.-]{1,253}$/.test(domain))
    || !data.authorizedDomains.includes(testProject.authDomain)) throw Error("FIREBASE_TEST_PROJECT_MISMATCH");
  return { status: "passed", projectId: testProject.projectId, appId: testProject.appId,
    scope: "public-test-project-configuration-only", publicProjectAndAppMatch: true,
    defaultAuthDomainPresent: true, authorizedDomains: data.authorizedDomains,
    accountsCreated: 0, emailsSent: 0, accountImports: 0, cloudflareChanges: 0,
    billingPlan: "not-verified-by-public-api", providerMethods: "not-verified-by-public-api",
    limitations: "Read-only public project/app binding evidence, not billing/Spark, method settings, password policy, API-key restrictions, mail delivery, signed identity/session or production acceptance." };
}
