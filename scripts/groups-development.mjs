import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { groupsSettingsPath, groupsConfigPath, groupsSeedPath, groupsStatePath } from "./test-environment.mjs";
export { groupsSettingsPath, groupsConfigPath, groupsStatePath } from "./test-environment.mjs";

// This profile never contains a real Cloudflare database ID or remote binding.
export const groupsBindings = [
  { binding: "DB", database_name: "okuma-local-accounts", database_id: "11111111-1111-4111-8111-111111111111" },
  { binding: "GROUP_SECOND", database_name: "okuma-local-second", database_id: "22222222-2222-4222-8222-222222222222" },
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
    writeFileSync(groupsSettingsPath, JSON.stringify({ sessionSecret: randomBytes(48).toString("hex"), password: randomBytes(18).toString("base64url") }), { mode: 0o600 });
  }
  writeFileSync(groupsConfigPath, JSON.stringify({ name: "okuma-local-groups", compatibility_date: "2026-05-15", d1_databases: groupsBindings }), { mode: 0o600 });
  const marker = groupsSeedPath;
  if (!existsSync(marker)) {
    if (existsSync(groupsStatePath)) throw new Error("Kismi veya onceki DB bulundu. Veriyi incele; kurulum otomatik silmez.");
    for (const binding of ["DB", "GROUP_SECOND"]) {
      for (const file of ["0000_strange_eternals", "0001_store_media_in_d1", "0002_member_accounts", "0003_member_profiles_and_reading_progress", "0004_face_recognition", "0005_club_tools", "0006_super_admin_roles", "0007_meeting_rsvps"]) {
        execute(binding, resolve(`drizzle/${file}.sql`));
      }
      execute(binding, resolve("demo/groups-local.sql"));
    }
    execute("DB", resolve("drizzle/0008_reading_groups.sql"));
    execute("DB", resolve("demo/groups-memberships-local.sql"));
    execute("GROUP_SECOND", resolve("demo/groups-second-local.sql"));
    writeFileSync(marker, new Date().toISOString());
  }
  console.log("Yerel grup ortami hazir. Hesaplar: demo.multi, demo.single, demo.none.");
  console.log(`Parola yalniz yerel ${groupsSettingsPath} dosyasindaki password alanindadir.`);
  console.log("Baslat: corepack pnpm groups:dev");
}
