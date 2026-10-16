import { parseArgs } from "node:util";
import { createHash, X509Certificate } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { execFileSync, spawnSync } from "node:child_process";
import { unzipSync } from "fflate";
import { evaluateRelease, checkManifest, checkSignature, elfSupports16k } from "./release-gate.mjs";
import { sourceIdentity } from "./release-source.mjs";

const { values } = parseArgs({ options: { evidence: { type: "string" }, web: { type: "string" }, android: { type: "string" }, bundle: { type: "string" }, bundletool: { type: "string" }, output: { type: "string", default: "outputs/release-readiness" } } });
const policy = JSON.parse(readFileSync("release/android-policy.json", "utf8"));
const load = (path) => path ? JSON.parse(readFileSync(path, "utf8")) : null;
const evidence = load(values.evidence);
const artifactChecks = [];
function check(id, ok, detail) { artifactChecks.push({ id, status: ok ? "passed" : "blocked", detail }); }
if (values.bundle && values.bundletool && evidence) {
  const temporary = mkdtempSync(join(tmpdir(), "okuma-aab-"));
  try {
    const bytes = readFileSync(values.bundle);
    check("aab", values.bundle.endsWith(".aab") && bytes.length > 0 && bytes.length < 512 * 1024 * 1024
      && createHash("sha256").update(bytes).digest("hex") === evidence.artifactSha256, "AAB dosyasi ve aday SHA256 eslesmesi.");
    const call = (command, args) => execFileSync(command, args, { encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
    const verified = spawnSync("jarsigner", ["-J-Duser.language=en", "-J-Duser.country=US", "-verify", "-strict", values.bundle], { encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
    if (verified.error) throw verified.error;
    const certificateOutput = call("keytool", ["-J-Duser.language=en", "-printcert", "-jarfile", values.bundle, "-rfc"]);
    verified.certificateCount = (certificateOutput.match(/-----BEGIN CERTIFICATE-----/g) || []).length;
    const certificate = new X509Certificate(certificateOutput);
    check("signature", checkSignature(verified, certificate, evidence.uploadCertificateSha256), "Strict imza dogrulamasi; imzasiz girdiler, debug veya gecersiz/beklenmeyen upload sertifikasi reddedilir.");
    const xml = call("java", ["-jar", values.bundletool, "dump", "manifest", `--bundle=${values.bundle}`, "--module=base"]);
    const file = join(temporary, "AndroidManifest.xml"); writeFileSync(file, xml);
    const mobileRequire = createRequire(new URL("../mobile/package.json", import.meta.url));
    const expoRequire = createRequire(mobileRequire.resolve("expo/package.json"));
    const { AndroidConfig } = expoRequire("@expo/config-plugins");
    check("manifest", checkManifest(await AndroidConfig.Manifest.readAndroidManifestAsync(file), policy, evidence), "Gercek manifest: paket/versionCode, API, debug/testOnly, HTTPS, yedekleme ve yasak izinler.");
    const entries = unzipSync(new Uint8Array(bytes), { filter: (entry) => /^base\/lib\/arm64-v8a\/[^/]+\.so$/.test(entry.name) || /^base\/assets\/.*(?:bundle|json|manifest)$/.test(entry.name) });
    const libraries = Object.entries(entries).filter(([name]) => name.startsWith("base/lib/arm64-v8a/"));
    check("arm64", libraries.length > 0, "ARM64 native kutuphaneleri pakette bulunmali.");
    check("elf-alignment", libraries.length > 0 && libraries.every(([, data]) => elfSupports16k(data)), "Her ARM64 ELF LOAD segmenti en az 16 KB hizalamali olmali; runtime/ZIP testi ayrica manuel.");
    check("bundle-origin", Object.entries(entries).some(([name, data]) => name.startsWith("base/assets/") && Buffer.from(data).includes(Buffer.from(evidence.appOrigin))), "Bildirilen HTTPS origin gercek native pakette bulunmali.");
  } catch (error) {
    check("inspection-error", false, `Paket incelemesi tamamlanamadi: ${error.message.split("\n")[0]}`);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
const report = evaluateRelease({ policy, source: sourceIdentity(), evidence, webReport: load(values.web), androidReport: load(values.android), artifactChecks });
report.candidate = evidence ? { artifactSha256: evidence.artifactSha256, uploadCertificateSha256: evidence.uploadCertificateSha256, versionCode: evidence.versionCode, appOrigin: evidence.appOrigin } : null;
report.checks.push(...artifactChecks.filter((item) => item.id === "inspection-error"));
if (artifactChecks.some((item) => item.status !== "passed")) report.status = "not-ready";
mkdirSync(values.output, { recursive: true });
writeFileSync(join(values.output, "report.json"), JSON.stringify(report, null, 2));
const lines = [`# Google Play: ${report.status}`, "", ...report.checks.map((item) => `- [${item.status === "passed" ? "x" : " "}] ${item.id}: ${item.detail}`), "", "Bu sonuc otomatik yayin veya Google onayi degildir. Korunan ortamda insan onayi ve Play incelemesi gereklidir."];
writeFileSync(join(values.output, "report.md"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
process.exitCode = report.status === "ready-for-manual-submission" ? 0 : 1;
