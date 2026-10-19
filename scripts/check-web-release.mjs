import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { sourceIdentity } from "./release-source.mjs";
import { webReleaseFailures } from "./web-release-policy.mjs";

function option(name) { return process.argv.slice(2).find((arg) => arg.startsWith(name + "="))?.slice(name.length + 1); }
if (process.argv.slice(2).some((arg) => !["--suite=", "--audit=", "--evidence="].some((prefix) => arg.startsWith(prefix)))) throw new Error("Supported: --suite=path --audit=path --evidence=path");
function read(path) { try { return path ? JSON.parse(readFileSync(path, "utf8")) : null; } catch { return null; } }
const proofRoot = resolve("outputs/web-acceptance");
const failures = webReleaseFailures({
  suite: read(option("--suite")), audit: read(option("--audit") || "outputs/web-security/dependency-audit.json"),
  evidence: read(option("--evidence")), current: sourceIdentity(),
  proofExists(path) {
    if (typeof path !== "string" || !existsSync(path)) return false;
    const stat = statSync(path);
    return stat.isFile() && stat.size > 0 && realpathSync(path).startsWith(proofRoot + sep);
  },
});
if (failures.length) { console.error("WEB RELEASE BLOCKED\n- " + failures.join("\n- ")); process.exitCode = 1; }
else console.log("Web evidence gate passed. This command does NOT deploy or guarantee security; operator approval is still required for the deployment action.");
