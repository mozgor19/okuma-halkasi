import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { sites } from "./build/sites-vite-plugin";
import { groupsBindings, groupsStatePath, readGroupsDevelopmentSettings } from "./scripts/groups-development.mjs";
import { testRunId, testOrigin, legacyOrigin } from "./scripts/test-environment.mjs";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "bbb0e55c-a354-4983-89e5-59b62eb3276a";

const { d1 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";

const localBindingConfig = {
  main: "vinext/server/fetch-handler",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "okuma-halkasi-db",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
};

export default defineConfig(async ({ command }) => {
  const legacyDevelopment = process.env.OKUMA_GROUPS_DEVELOPMENT === "legacy";
  const groupsDevelopment = process.env.OKUMA_GROUPS_DEVELOPMENT === "1" || legacyDevelopment;
  const firebaseLocal = process.env.OKUMA_FIREBASE_LOCAL === "1";
  if (firebaseLocal && (command !== "serve" || !groupsDevelopment || legacyDevelopment || !testRunId.startsWith("firebase-local-"))) throw new Error("Firebase integration is local isolated serve-only.");
  if (groupsDevelopment && command !== "serve") throw new Error("Yerel grup profili build/deploy icin kullanilamaz.");
  const groupSettings = groupsDevelopment ? readGroupsDevelopmentSettings() : null;
  // Use Miniflare's local Request.cf placeholder unless fetching is requested.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    ...(groupsDevelopment ? { cacheDir: `node_modules/.vite-${legacyDevelopment ? "legacy" : "groups"}${testRunId ? "-" + testRunId : ""}` } : {}),
    server: {
      fs: { deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.sites-runtime/**", "**/.wrangler/**", "**/outputs/**", "**/*.sqlite", "**/*.sqlite-wal", "**/*.sqlite-shm"] },
      ...(managedLinux ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] } : {}),
      watch: {
        ...(isCodexSeatbeltSandbox ? { useFsEvents: false, usePolling: true } : {}),
        ignored: ["**/mobile/android/**", "**/mobile/ios/**", "**/.sites-runtime/**", "**/.wrangler/**", "**/outputs/**"],
      },
      ...(groupsDevelopment ? { host: "127.0.0.1", port: Number(new URL(legacyDevelopment ? legacyOrigin : testOrigin).port), strictPort: true } : {}),
    },
    plugins: [
      vinext(),
      sites({ mockAuth: !managedLinux }),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        ...(groupsDevelopment ? { persistState: { path: groupsStatePath }, remoteBindings: false } : {}),
        config: groupSettings ? {
          ...localBindingConfig,
          d1_databases: groupsBindings,
          vars: {
            READING_GROUPS_ENABLED: legacyDevelopment ? "false" : "true",
            READING_GROUP_DB_BINDINGS: JSON.stringify(groupsBindings.filter((item) => item.binding !== "DB").map((item) => item.binding)),
            SELF_SERVICE_ENABLED: !legacyDevelopment && process.env.OKUMA_SELF_SERVICE_DEVELOPMENT === "1" ? "true" : "false",
            SELF_SERVICE_LOCAL: "true",
            ...(process.env.OKUMA_APPLICATION_BRAND ? { APPLICATION_BRAND: process.env.OKUMA_APPLICATION_BRAND } : {}),
            ...(process.env.OKUMA_BRAND_ORIGIN ? { AUTH_PUBLIC_ORIGIN: process.env.OKUMA_BRAND_ORIGIN } : {}),
            ...(firebaseLocal ? { AUTH_PROVIDER: "firebase-local", AUTH_PUBLIC_ORIGIN: testOrigin, FIREBASE_LOCAL_EMULATOR_ORIGIN: process.env.OKUMA_FIREBASE_EMULATOR_ORIGIN } : {}),
            SELF_SERVICE_GROUP_BINDINGS: JSON.stringify(["GROUP_POOL_ONE", "GROUP_POOL_TWO", "GROUP_POOL_THREE"]),
            SESSION_SECRET: groupSettings.sessionSecret,
            MEMBER_CREDENTIALS: JSON.stringify(Object.fromEntries(["demo.multi", "demo.single", "demo.none"].map((name, index) => [name, { memberId: index + 1, password: groupSettings.password }]))),
          },
        } : localBindingConfig,
      }),
    ],
  };
});
