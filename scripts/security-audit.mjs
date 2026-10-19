import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { sourceIdentity } from "./release-source.mjs";

// Keep registry response bodies out of CI logs. Distinguish workspace tooling from web paths.
const result = spawnSync("corepack", ["pnpm", "audit", "--prod", "--json"], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, timeout: 120_000 });
let audit;
try { audit = JSON.parse(result.stdout); } catch { throw new Error("Dependency audit unavailable; release remains blocked."); }
if (!audit.metadata?.vulnerabilities || !audit.advisories) throw new Error("Invalid dependency audit response; release remains blocked.");
const findings = Object.values(audit.advisories).map((item) => ({
  id: item.github_advisory_id, package: item.module_name, severity: item.severity,
  vulnerable: item.vulnerable_versions, patched: item.patched_versions,
  source: item.url,
  web: item.findings.some((finding) => finding.paths.some((path) => path.startsWith(".>"))),
  mobile: item.findings.some((finding) => finding.paths.some((path) => path.startsWith("mobile>"))),
}));
const blocked = findings.filter((item) => item.web && ["high", "critical"].includes(item.severity));
const report = { ...sourceIdentity(), checkedAt: new Date().toISOString(), status: blocked.length ? "blocked" : "passed", findings, counts: audit.metadata.vulnerabilities };
mkdirSync("outputs/web-security", { recursive: true });
writeFileSync("outputs/web-security/dependency-audit.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (blocked.length) process.exitCode = 1;
