import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Public resource identifiers, never credentials. This tool cannot target production.
export const staging = Object.freeze({
  accountId: "6ad247650748c51ec17b6a47d0a6b6f4",
  worker: "koru-staging",
  origin: "https://koru-staging.mustafayapayzeka.workers.dev",
  databases: [
    { binding: "DB", database_name: "koru-staging-main", database_id: "a0e72c79-f529-46d9-a2f3-8871abd97780" },
    { binding: "GROUP_POOL_ONE", database_name: "koru-staging-group-1", database_id: "d08b6312-1ed1-4042-9941-1186d48b8dce" },
    { binding: "GROUP_POOL_TWO", database_name: "koru-staging-group-2", database_id: "4bbae5c5-aea5-4aa9-928c-3d2a9bbf75ae" },
    { binding: "GROUP_CREATE_ONE", database_name: "koru-staging-create-1", database_id: "895b412e-0113-4597-a8fe-cd5c1f3178f5" },
    { binding: "GROUP_CREATE_TWO", database_name: "koru-staging-create-2", database_id: "569713c3-82d5-420e-972d-22db9ad04480" },
  ],
});

export const stagingDirectory = resolve(".sites-runtime/koru-staging");
export const stagingConfigPath = resolve(stagingDirectory, "wrangler.json");
export const stagingCredentialsPath = resolve(stagingDirectory, "credentials.json");
export const stagingTestEmails = Object.freeze(["koru.destek@gmail.com", "koru.destek+deneme1@gmail.com", "koru.destek+deneme2@gmail.com"]);
export const creationBindings = Object.freeze(["GROUP_CREATE_ONE", "GROUP_CREATE_TWO"]);

export function stagingFailure(error) {
  // Browser errors can contain cookies, authorization headers and token-bearing URLs.
  if (error?.code === "ERR_ASSERTION") return "Staging assertion failed.";
  if (error?.name === "TimeoutError") return "Staging browser operation timed out.";
  return "Staging verification failed; inspect the last completed check and screenshots.";
}

export const groups = [
  { id: "staging-one", name: "Koru Test Grubu 1", binding: "GROUP_POOL_ONE" },
  { id: "staging-two", name: "Koru Test Grubu 2", binding: "GROUP_POOL_TWO" },
];

export function applicationTables(rows) {
  return rows.map((row) => row.name).filter((name) => !name.startsWith("sqlite_") && !["_cf_KV", "_cf_METADATA"].includes(name));
}

const domainMigrations = [
  "0000_strange_eternals", "0001_store_media_in_d1", "0002_member_accounts",
  "0003_member_profiles_and_reading_progress", "0004_face_recognition",
  "0005_club_tools", "0006_super_admin_roles", "0007_meeting_rsvps",
];

export function schemaFor(binding) {
  if (!staging.databases.some((item) => item.binding === binding)) throw new Error("Unknown staging binding");
  const names = [...domainMigrations, ...(binding === "DB" ? ["0008_reading_groups", "0009_self_service"] : []), "0010_group_account_links"];
  const sql = names.map((name) => readFileSync(resolve(`drizzle/${name}.sql`), "utf8")).join("\n");
  return { sql, names, digest: createHash("sha256").update(sql).digest("hex") };
}

export function assertBindings(bindings, { allowUnboundPool = false } = {}) {
  const databases = bindings.filter((item) => item.type === "d1");
  if (databases.length !== staging.databases.length && !allowUnboundPool) throw new Error("Unexpected staging database count");
  if (new Set(databases.map((db) => db.name)).size !== databases.length
    || databases.some((db) => !staging.databases.some((expected) => db.name === expected.binding && db.database_id === expected.database_id))) throw new Error("Unexpected staging database identity");
  for (const expected of staging.databases) {
    if (allowUnboundPool && creationBindings.includes(expected.binding) && !databases.some((db) => db.name === expected.binding)) continue;
    if (!databases.some((item) => item.name === expected.binding && item.database_id === expected.database_id)) {
      throw new Error(`Wrong staging database: ${expected.binding}`);
    }
  }
  const site = bindings.find((item) => item.name === "TURNSTILE_SITE_KEY");
  if (site?.type !== "plain_text" || typeof site.text !== "string" || !site.text.trim()) throw new Error("Missing staging Turnstile site key");
  if (!bindings.some((item) => item.name === "TURNSTILE_SECRET_KEY" && item.type === "secret_text")) throw new Error("Missing staging Turnstile secret binding");
  return site.text;
}

export function deploymentConfig(built, siteKey, { onboarding = false } = {}) {
  if (built.main !== "index.js" || built.assets?.directory !== "../client" || built.no_bundle !== true) throw new Error("Unexpected framework build structure");
  return {
    name: staging.worker, account_id: staging.accountId,
    main: resolve("dist/server/index.js"), no_bundle: true,
    compatibility_date: built.compatibility_date,
    compatibility_flags: built.compatibility_flags,
    rules: built.rules,
    assets: { directory: resolve("dist/client") },
    workers_dev: true, preview_urls: false,
    d1_databases: staging.databases,
    vars: {
      APPLICATION_BRAND: "Koru", SUPPORT_EMAIL: "koru.destek@gmail.com",
      AUTH_PUBLIC_ORIGIN: staging.origin, STAGING_ENVIRONMENT: "true",
      READING_GROUPS_ENABLED: "true",
      READING_GROUP_DB_BINDINGS: JSON.stringify(staging.databases.filter((db) => db.binding !== "DB").map((db) => db.binding)),
      SELF_SERVICE_ENABLED: onboarding ? "true" : "false", SELF_SERVICE_LOCAL: "false", SELF_SERVICE_GROUP_BINDINGS: JSON.stringify(onboarding ? creationBindings : []),
      PRIVACY_POLICY_URL: `${staging.origin}/privacy`, TERMS_URL: `${staging.origin}/terms`,
      ACCOUNT_MAIL_PROVIDER: "gmail", MAIL_FROM: "koru.destek@gmail.com",
      TURNSTILE_SITE_KEY: siteKey,
    },
  };
}

export function assertDeployment(config) {
  if (config.name !== staging.worker || config.account_id !== staging.accountId || config.workers_dev !== true || config.preview_urls !== false) throw new Error("Wrong deployment target");
  if (JSON.stringify(config.d1_databases) !== JSON.stringify(staging.databases)) throw new Error("Wrong deployment databases");
  if (config.vars?.AUTH_PUBLIC_ORIGIN !== staging.origin || !["true", "false"].includes(config.vars?.SELF_SERVICE_ENABLED) || config.vars?.SELF_SERVICE_LOCAL !== "false") throw new Error("Unsafe staging registration configuration");
  if (config.main !== resolve("dist/server/index.js") || config.assets?.directory !== resolve("dist/client") || config.no_bundle !== true) throw new Error("Wrong staging artifact");
  const allowed = new Set(Object.keys(deploymentConfig({ main: "index.js", assets: { directory: "../client" }, no_bundle: true }, "placeholder").vars));
  if (Object.keys(config.vars).some((key) => !allowed.has(key))) throw new Error("Unexpected staging variable; secrets must not be bundled");
  const expectedVars = deploymentConfig({ main: "index.js", assets: { directory: "../client" }, no_bundle: true }, config.vars.TURNSTILE_SITE_KEY, { onboarding: config.vars.SELF_SERVICE_ENABLED === "true" }).vars;
  if (typeof config.vars.TURNSTILE_SITE_KEY !== "string" || !config.vars.TURNSTILE_SITE_KEY.trim()
    || Object.entries(expectedVars).some(([key, value]) => config.vars[key] !== value)) throw new Error("Staging runtime policy changed");
  const keys = new Set(["name", "account_id", "main", "no_bundle", "compatibility_date", "compatibility_flags", "rules", "assets", "workers_dev", "preview_urls", "d1_databases", "vars"]);
  if (Object.keys(config).some((key) => !keys.has(key))) throw new Error("Unexpected deployment resource or route");
}

export function seedFor(binding, accounts) {
  if (creationBindings.includes(binding)) return [];
  if (binding === "DB") return [
    { sql: "INSERT INTO members(id,name,role) VALUES (1,?,'member'),(2,?,'member')", params: [accounts[0].name, accounts[1].name] },
    ...accounts.map((account, index) => ({
      sql: "INSERT INTO member_accounts(member_id,username,password_hash,password_salt,password_iterations) VALUES (?,?,?,?,?)",
      params: [index + 1, account.username, account.hash, account.salt, account.iterations],
    })),
    { sql: "INSERT INTO reading_groups(id,name,binding_name) VALUES (?,?,?),(?,?,?)", params: groups.flatMap((group) => [group.id, group.name, group.binding]) },
    { sql: "INSERT INTO reading_group_memberships(account_member_id,group_id,member_id,scheme,color_mode) VALUES (1,?,1,'notebook','light'),(2,?,2,'notebook','light'),(1,?,7,'catalogue','dark')", params: [groups[0].id, groups[0].id, groups[1].id] },
  ];
  const first = binding === "GROUP_POOL_ONE";
  if (!first && binding !== "GROUP_POOL_TWO") throw new Error("Unknown seed target");
  return [
    { sql: first ? "INSERT INTO members(id,name,role) VALUES (1,?,'super_admin'),(2,?,'member')" : "INSERT INTO members(id,name,role) VALUES (7,?,'member')", params: first ? accounts.map((a) => a.name) : [accounts[0].name] },
    { sql: "INSERT INTO group_database_ownership(singleton,group_id) VALUES (1,?)", params: [groups[first ? 0 : 1].id] },
    { sql: first ? "INSERT INTO group_account_links(account_member_id,member_id) VALUES (1,1),(2,2)" : "INSERT INTO group_account_links(account_member_id,member_id) VALUES (1,7)", params: [] },
    { sql: "INSERT INTO books(id,title,author,pages) VALUES (1,?,'Test Yazari',240)", params: [first ? "Birinci Grup Kitabi" : "Ikinci Grup Kitabi"] },
    { sql: "INSERT INTO meetings(id,book_id,date,location,note,created_by) VALUES (1,1,'2099-01-01T15:00',?,'Yalnizca test kaydi',?)", params: [first ? "Birinci grup test yeri" : "Ikinci grup test yeri", first ? 1 : 7] },
    { sql: "INSERT INTO roadmap(id,book_id,planned_date,note,created_by) VALUES (1,1,'2099-02-01','Test okuma plani',?)", params: [first ? 1 : 7] },
  ];
}
