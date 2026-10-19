import { spawn } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync, openSync, closeSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { groupsBindings, readGroupsDevelopmentSettings } from "./groups-development.mjs";
import { testRunId, groupsStatePath, groupsSettingsPath } from "./test-environment.mjs";

if (!testRunId || process.argv.slice(2).some((arg) => !/^--port=\d+$/.test(arg))) throw new Error("A named local fixture profile and optional --port are required.");
const port = Number(process.argv.find((arg) => arg.startsWith("--port="))?.slice(7) || "5197");
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid local port.");
const built = JSON.parse(readFileSync("dist/server/wrangler.json", "utf8"));
if (built.main !== "index.js" || built.assets?.directory !== "../client") throw new Error("Review the changed build layout first.");
const settings = readGroupsDevelopmentSettings();
const directory = resolve(dirname(groupsSettingsPath), "production-preview");
mkdirSync(directory, { recursive: true });
const config = resolve(directory, "wrangler.json");
// Allowlist only build/runtime fields. Never copy production IDs, routes or bindings.
writeFileSync(config, JSON.stringify({
  name: "koru-isolated-local-preview", main: resolve("dist/server/index.js"), no_bundle: true,
  compatibility_date: built.compatibility_date, compatibility_flags: built.compatibility_flags,
  rules: built.rules,
  assets: { directory: resolve("dist/client") },
  d1_databases: groupsBindings,
  vars: {
    APPLICATION_BRAND: "Koru", AUTH_PUBLIC_ORIGIN: "https://koru.example",
    READING_GROUPS_ENABLED: "true", READING_GROUP_DB_BINDINGS: JSON.stringify(groupsBindings.filter((item) => item.binding !== "DB").map((item) => item.binding)),
    SELF_SERVICE_ENABLED: "true", SELF_SERVICE_LOCAL: "true",
    SELF_SERVICE_GROUP_BINDINGS: JSON.stringify(["GROUP_POOL_ONE", "GROUP_POOL_TWO", "GROUP_POOL_THREE"]),
    SESSION_SECRET: settings.sessionSecret,
    MEMBER_CREDENTIALS: JSON.stringify(Object.fromEntries(["demo.multi", "demo.single", "demo.none"].map((name, index) => [name, { memberId: index + 1, password: settings.password }]))),
  },
}, null, 2), { mode: 0o600 });
const log = openSync(resolve(directory, "wrangler.log"), "w", 0o600);
const child = spawn(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "dev", "--config", config, "--local", "--persist-to", groupsStatePath,
  "--ip", "127.0.0.1", "--port", String(port), "--inspector-port", "0"], {
  stdio: ["ignore", log, log], env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", CLOUDFLARE_CF_FETCH_ENABLED: "false" },
});
console.log(`Isolated local production preview starting: http://127.0.0.1:${port}`);
console.log("Local generated credentials/bindings are written only to the private fixture directory. No deployment.");
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => child.kill(signal));
child.once("error", () => { closeSync(log); console.error("Local preview could not start; inspect its private log."); process.exitCode = 1; });
child.once("exit", (code) => { closeSync(log); process.exitCode = code || 0; });
