export const production = Object.freeze({
  accountId: "6ad247650748c51ec17b6a47d0a6b6f4",
  worker: "okuma-halkasi",
  origin: "https://birkoru.com",
  legacyOrigin: "https://okuma-halkasi.mustafayapayzeka.workers.dev",
  firebaseProjectId: "koru-951bf",
  turnstileSiteKey: "0x4AAAAAAFdcSVotjRtGDJZM",
  canonicalDatabaseId: "bbb0e55c-a354-4983-89e5-59b62eb3276a",
});

export function productionBindingFailures(bindings) {
  const failures = [];
  const databases = bindings.filter((item) => item.type === "d1");
  if (!databases.some((item) => item.name === "DB" && item.database_id === production.canonicalDatabaseId)
    || new Set(databases.map((item) => item.name)).size !== databases.length
    || new Set(databases.map((item) => item.database_id)).size !== databases.length) failures.push("Canonical DB or unique binding identity mismatch.");
  const value = (name) => bindings.find((item) => item.type === "plain_text" && item.name === name)?.text;
  for (const [name, expected] of Object.entries({
    APPLICATION_BRAND: "Koru", AUTH_PUBLIC_ORIGIN: production.origin, READING_GROUPS_ENABLED: "true", SELF_SERVICE_ENABLED: "true",
    SELF_SERVICE_LOCAL: "false", STAGING_ENVIRONMENT: "false", SUPPORT_EMAIL: "koru.destek@gmail.com",
    FACE_RECOGNITION_ENABLED: "false",
    AUTH_PROVIDER: "firebase", FIREBASE_PROJECT_ID: production.firebaseProjectId,
    // Existing hashes are verified only; new passwords are managed by Firebase.
    PASSWORD_HASH_ITERATIONS: "100000",
    PRIVACY_POLICY_URL: production.origin + "/privacy", TERMS_URL: production.origin + "/terms",
  })) if (value(name) !== expected) failures.push("Runtime configuration requires review: " + name);
  for (const secret of ["SESSION_SECRET", "TURNSTILE_SECRET_KEY", "FIREBASE_API_KEY", "ERASURE_OPERATOR_SECRET"]) if (!bindings.some((item) => item.name === secret && item.type === "secret_text")) failures.push("Required secret binding absent: " + secret);
  if (value("MAINTENANCE_MODE") !== "false") failures.push("Public opening requires maintenance mode explicitly off.");
  if (value("TURNSTILE_SITE_KEY") !== production.turnstileSiteKey) failures.push("Production Turnstile site key absent or mismatched.");
  if (bindings.some((item) => ["FIREBASE_LOCAL_EMULATOR_ORIGIN", "FIREBASE_AUTH_EMULATOR_HOST", "GMAIL_CREDENTIALS", "RESEND_API_KEY", "MEMBER_CREDENTIALS"].includes(item.name)))
    failures.push("Emulator, legacy bootstrap or unrelated mail credentials cannot be promoted to production Firebase.");
  if (bindings.some((item) => item.name === "SELF_SERVICE_TEST_EMAILS")) failures.push("A staging email allowlist cannot remain on the public production Worker.");
  for (const name of ["READING_GROUP_DB_BINDINGS", "SELF_SERVICE_GROUP_BINDINGS"]) {
    try {
      const names = JSON.parse(value(name) || "null");
      if (!Array.isArray(names) || !names.length || new Set(names).size !== names.length
        || names.some((item) => typeof item !== "string" || item === "DB" || !databases.some((db) => db.name === item))) throw new Error();
      if (name === "SELF_SERVICE_GROUP_BINDINGS") {
        const allowed = JSON.parse(value("READING_GROUP_DB_BINDINGS") || "null");
        if (!Array.isArray(allowed) || names.some((item) => !allowed.includes(item))) throw new Error();
      }
    } catch { failures.push("Group binding capacity/configuration requires review: " + name); }
  }
  return failures;
}
