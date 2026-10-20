import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL("./", import.meta.url));
const result = spawnSync("corepack", ["pnpm", "audit", "--json"], {
  cwd: here, encoding: "utf8", timeout: 120000, maxBuffer: 20 * 1024 * 1024,
});
let audit;
try { audit = JSON.parse(result.stdout); } catch { throw Error("PROTOTYPE_AUDIT_UNAVAILABLE"); }
if (!audit.metadata?.vulnerabilities || !audit.advisories) throw Error("PROTOTYPE_AUDIT_INVALID");
const findings = Object.values(audit.advisories).map((item) => ({
  package: item.module_name, severity: item.severity, source: item.url,
  paths: item.findings.flatMap((finding) => finding.paths),
}));
const blocked = findings.some((item) => ["high", "critical"].includes(item.severity));
const report = { scope: "isolated-local-firebase-tooling", checkedAt: new Date().toISOString(),
  status: blocked ? "blocked" : "passed", counts: audit.metadata.vulnerabilities, findings };
const folder = new URL("../../.sites-runtime/firebase-prototype/", import.meta.url);
await mkdir(folder, { recursive: true, mode: 0o700 });
await writeFile(new URL("dependency-audit.json", folder), JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
if (blocked) process.exitCode = 1;
