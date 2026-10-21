import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { groupsSettingsPath, groupsConfigPath, groupsSeedPath, groupsStatePath } from "./test-environment.mjs";
export { groupsSettingsPath, groupsConfigPath, groupsStatePath } from "./test-environment.mjs";

// Synthetic accounts also exercise the real password-change policy.
export const developmentPassword = () => "Local-Test-7-" + randomBytes(18).toString("base64url");

// This profile never contains a real Cloudflare database ID or remote binding.
export const groupsBindings = [
  { binding: "DB", database_name: "okuma-local-accounts", database_id: "11111111-1111-4111-8111-111111111111" },
  { binding: "GROUP_SECOND", database_name: "okuma-local-second", database_id: "22222222-2222-4222-8222-222222222222" },
  { binding: "GROUP_POOL_ONE", database_name: "okuma-local-pool-one", database_id: "33333333-3333-4333-8333-333333333333" },
  { binding: "GROUP_POOL_TWO", database_name: "okuma-local-pool-two", database_id: "44444444-4444-4444-8444-444444444444" },
  { binding: "GROUP_POOL_THREE", database_name: "okuma-local-pool-three", database_id: "55555555-5555-4555-8555-555555555555" },
];

export function readGroupsDevelopmentSettings() {
  if (!existsSync(groupsSettingsPath)) throw new Error("Once pnpm groups:setup calistir.");
  return JSON.parse(readFileSync(groupsSettingsPath, "utf8"));
}

function execute(binding, file) {
  const result = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", binding,
    "--local", "--config", groupsConfigPath, "--persist-to", groupsStatePath, "--file", file], {
    stdio: "pipe", env: { ...process.env, WRANGLER_SEND_METRICS: "false", CLOUDFLARE_CF_FETCH_ENABLED: "false", WRANGLER_LOG_PATH: resolve(".sites-runtime/wrangler/logs") },
  });
  if (result.status !== 0) throw new Error(`Yerel DB kurulumu basarisiz (${binding}, ${file}). ${result.stderr?.toString() || ""}`);
}

if (process.argv[1] === resolve("scripts/groups-development.mjs")) {
  mkdirSync(dirname(groupsConfigPath), { recursive: true });
  if (!existsSync(groupsSettingsPath)) {
    writeFileSync(groupsSettingsPath, JSON.stringify({ sessionSecret: randomBytes(48).toString("hex"), password: developmentPassword() }), { mode: 0o600 });
  }
  writeFileSync(groupsConfigPath, JSON.stringify({ name: "okuma-local-groups", compatibility_date: "2026-05-15", d1_databases: groupsBindings }), { mode: 0o600 });
  const marker = groupsSeedPath;
  if (!existsSync(marker)) {
    if (existsSync(groupsStatePath)) throw new Error("Kismi veya onceki DB bulundu. Veriyi incele; kurulum otomatik silmez.");
    for (const { binding } of groupsBindings) {
      for (const file of ["0000_strange_eternals", "0001_store_media_in_d1", "0002_member_accounts", "0003_member_profiles_and_reading_progress", "0004_face_recognition", "0005_club_tools", "0006_super_admin_roles", "0007_meeting_rsvps"]) {
        execute(binding, resolve(`drizzle/${file}.sql`));
      }
      execute(binding, resolve("drizzle/0010_group_account_links.sql"));
      execute(binding, resolve("drizzle/0016_meeting_details.sql"));
      if (["DB", "GROUP_SECOND"].includes(binding)) execute(binding, resolve("demo/groups-local.sql"));
    }
    execute("DB", resolve("drizzle/0008_reading_groups.sql"));
    execute("DB", resolve("drizzle/0009_self_service.sql"));
    execute("DB", resolve("drizzle/0011_account_experience.sql"));
    execute("DB", resolve("drizzle/0012_account_erasure_jobs.sql"));
    execute("DB", resolve("drizzle/0015_shared_group_storage.sql"));
    execute("DB", resolve("drizzle/0017_group_communication.sql"));
    if (process.env.OKUMA_FIREBASE_LOCAL === "1") {
      if (!process.env.OKUMA_TEST_RUN_ID?.startsWith("firebase-local-")) throw new Error("Firebase integration requires a fresh named local fixture.");
      execute("DB", resolve("prototypes/firebase-auth/local-integration-schema.sql"));
    }
    execute("DB", resolve("demo/groups-memberships-local.sql"));
    execute("GROUP_SECOND", resolve("demo/groups-second-local.sql"));
    writeFileSync(marker, new Date().toISOString());
  }
  console.log("Yerel grup ortami hazir. Hesaplar: demo.multi, demo.single, demo.none.");
  console.log(`Parola yalniz yerel ${groupsSettingsPath} dosyasindaki password alanindadir.`);
  console.log("Baslat: corepack pnpm groups:dev");
}
