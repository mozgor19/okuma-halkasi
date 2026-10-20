import { readProviderJson } from "../prototypes/firebase-auth/provider-http.mjs";

// Explicitly selected production resources; never adopt the completed test project.
export const productionFirebase = Object.freeze({
  projectId: "koru-951bf",
  projectNumber: "605673770248",
  authDomain: "koru-951bf.firebaseapp.com",
  appId: "1:605673770248:web:7ccfda11ed8fed8273b0bd",
  applicationDomain: "birkoru.com",
});

export function approvedProductionFirebaseConfig(input) {
  const keys = ["apiKey", "authDomain", "projectId", "appId"];
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).length !== keys.length || Object.keys(input).some((key) => !keys.includes(key))
    || keys.slice(1).some((key) => input[key] !== productionFirebase[key])
    || typeof input.apiKey !== "string" || !/^AIza[A-Za-z0-9_-]{35}$/.test(input.apiKey)) throw Error("FIREBASE_PRODUCTION_CONFIG_REJECTED");
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, input[key]])));
}

export async function preflightProductionFirebase(input, { request = fetch, environment = process.env } = {}) {
  const config = approvedProductionFirebaseConfig(input);
  if (["FIREBASE_AUTH_EMULATOR_HOST", "GOOGLE_APPLICATION_CREDENTIALS", "FIREBASE_TOKEN", "CLOUDSDK_AUTH_ACCESS_TOKEN"].some((key) => environment[key]))
    throw Error("FIREBASE_PRODUCTION_CREDENTIAL_ENV_REJECTED");
  const url = new URL("https://identitytoolkit.googleapis.com/v1/projects");
  url.searchParams.set("key", config.apiKey);
  url.searchParams.set("firebaseAppId", config.appId);
  let response;
  try {
    response = await request(url.href, { method: "GET", redirect: "error", credentials: "omit", cache: "no-store",
      signal: AbortSignal.timeout(10_000), headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch { throw Error("FIREBASE_PRODUCTION_PREFLIGHT_NETWORK"); }
  if (!response.ok) { await response.body?.cancel(); throw Error("FIREBASE_PRODUCTION_PREFLIGHT_HTTP_" + response.status); }
  let data;
  try { data = await readProviderJson(response); } catch { throw Error("FIREBASE_PRODUCTION_PREFLIGHT_RESPONSE"); }
  if (!data || ![productionFirebase.projectId, productionFirebase.projectNumber].includes(data.projectId)
    || !Array.isArray(data.authorizedDomains) || data.authorizedDomains.length > 100
    || !data.authorizedDomains.every((domain) => typeof domain === "string" && /^[a-zA-Z0-9.-]{1,253}$/.test(domain))
    || !data.authorizedDomains.includes(productionFirebase.authDomain)) throw Error("FIREBASE_PRODUCTION_PROJECT_MISMATCH");
  const applicationDomainPresent = data.authorizedDomains.includes(productionFirebase.applicationDomain);
  return { status: applicationDomainPresent ? "passed" : "configuration-required", scope: "public-production-project-configuration-only",
    projectId: productionFirebase.projectId, appId: productionFirebase.appId, publicProjectAndAppMatch: true,
    defaultAuthDomainPresent: true, applicationDomainPresent, requiredApplicationDomain: productionFirebase.applicationDomain,
    accountsCreated: 0, emailsSent: 0, accountImports: 0, cloudflareChanges: 0,
    billingPlan: "not-verified-by-public-api", providerMethods: "not-verified-by-public-api",
    limitations: "Read-only project/app/domain check. Not Spark/billing, password policy, key restrictions, mail, runtime/session, account migration, erasure or launch acceptance." };
}
