const sha256 = /^[a-f0-9]{64}$/i;
const commitHash = /^[a-f0-9]{40}$/i;

export function publicHttpsOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value && !url.username && !url.password
      && url.hostname.includes(".") && !/(?:\.(?:localhost|local|invalid|test)$)|^(?:127\.|10\.|192\.168\.|169\.254\.|0\.)|^172\.(?:1[6-9]|2\d|3[01])\./i.test(url.hostname);
  } catch { return false; }
}

function fresh(value, now, maximumDays) {
  const date = Date.parse(value);
  return Number.isFinite(date) && date <= now + 60_000 && date >= now - maximumDays * 86_400_000;
}

export function evaluateRelease({ policy, source, evidence, webReport, androidReport, artifactChecks = [], now = Date.now() }) {
  const checks = [];
  const check = (id, ok, detail) => checks.push({ id, status: ok ? "passed" : "blocked", detail });
  check("policy", policy.schemaVersion === 1 && Number.isFinite(Date.parse(policy.reviewBy)) && now <= Date.parse(policy.reviewBy + "T23:59:59Z"), "Google Play kurallari duzenli yeniden incelenmeli.");
  check("clean-source", source.dirty === false && commitHash.test(source.commit) && sha256.test(source.sourceDigest), "Commit edilmemis degisiklikle yayin onayi verilmez.");
  check("candidate", evidence?.schemaVersion === 1 && evidence.commit === source.commit && evidence.sourceDigest === source.sourceDigest
    && sha256.test(evidence.artifactSha256) && sha256.test(evidence.uploadCertificateSha256) && publicHttpsOrigin(evidence.appOrigin)
    && Number.isSafeInteger(evidence.versionCode) && evidence.versionCode > evidence.previousVersionCode
    && Number.isSafeInteger(evidence.previousVersionCode) && evidence.previousVersionCode >= 0 && evidence.versionCode <= 2_100_000_000,
  "Ayni commit, kaynak ozeti, AAB SHA256, upload sertifikasi, HTTPS origin ve artan versionCode gerekli.");
  for (const [id, report, platform, required] of [
    ["web-suite", webReport, "web", policy.webSteps],
    ["android-suite", androidReport, "android-emulator", policy.androidSteps],
  ]) {
    check(id, report?.schemaVersion === 1 && report.status === "passed" && report.platform === platform
      && report.commit === source.commit && report.sourceDigest === source.sourceDigest && report.dirty === false
      && fresh(report.finishedAt, now, policy.maximumEvidenceAgeDays)
      && fresh(report.startedAt, now, policy.maximumEvidenceAgeDays) && Date.parse(report.startedAt) <= Date.parse(report.finishedAt)
      && Array.isArray(report.steps) && required.every((step) => report.steps.some((value) => value.id === step && value.status === "passed"))
      && report.steps.every((step) => step.status === "passed"),
    "Eksiksiz, guncel ve tam bu kaynak surumune ait otomatik rapor gerekli; eski ekran goruntuleri yeterli degil.");
  }
  const artifactIds = ["aab", "signature", "manifest", "arm64", "elf-alignment", "bundle-origin"];
  for (const id of artifactIds) {
    const result = artifactChecks.find((item) => item.id === id);
    check(`artifact-${id}`, result?.status === "passed", result?.detail || "Imzali AAB ve bundletool ile gercek paket incelenmedi.");
  }
  for (const requirement of policy.manualChecks) {
    const approval = evidence?.approvals?.[requirement.id];
    check(`manual-${requirement.id}`, approval?.status === "passed" && typeof approval.by === "string" && approval.by.trim().length >= 3
      && typeof approval.evidence === "string" && approval.evidence.trim().length >= 8
      && fresh(approval.at, now, policy.maximumEvidenceAgeDays), requirement.label);
  }
  return { schemaVersion: 1, ...source, evaluatedAt: new Date(now).toISOString(), status: checks.every((item) => item.status === "passed") ? "ready-for-manual-submission" : "not-ready", checks };
}

export function checkManifest(manifest, policy, evidence) {
  const app = manifest?.manifest?.application?.[0]?.$;
  const root = manifest?.manifest?.$;
  const sdk = manifest?.manifest?.["uses-sdk"]?.[0]?.$;
  const permissions = [...(manifest?.manifest?.["uses-permission"] || []), ...(manifest?.manifest?.["uses-permission-sdk-23"] || [])].map((entry) => entry.$?.["android:name"]);
  const forbidden = permissions.filter((permission) => policy.forbiddenPermissions.includes(permission));
  return Boolean(app && root && sdk && root.package === policy.applicationId
    && Number(root["android:versionCode"]) === evidence.versionCode && Number(sdk["android:targetSdkVersion"]) >= policy.minimumTargetSdk
    && app["android:debuggable"] !== "true" && app["android:testOnly"] !== "true"
    && app["android:usesCleartextTraffic"] !== "true" && app["android:allowBackup"] === "false"
    && !app["android:networkSecurityConfig"] && forbidden.length === 0);
}

export function checkSignature(result, certificate, expectedFingerprint, now = Date.now()) {
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  // Android upload certificates are normally self-signed (strict warning bit 4).
  // Every other strict error, unsigned entry and disabled algorithm is rejected.
  return result.certificateCount === 1 && [0, 4].includes(result.status) && /jar verified(?:, with signer errors)?\./i.test(output)
    && !/unsigned entries|jar is unsigned|disabled|treated as unsigned/i.test(output)
    && !/Android Debug/i.test(certificate.subject)
    && certificate.fingerprint256.replaceAll(":", "").toLowerCase() === expectedFingerprint.toLowerCase()
    && Date.parse(certificate.validFrom) <= now && Date.parse(certificate.validTo) > now;
}

// ELF64 program headers: verify every load segment can be mapped on 16 KB pages.
export function elfSupports16k(bytes) {
  try {
    if (bytes.length < 64 || bytes[0] !== 0x7f || bytes[1] !== 69 || bytes[2] !== 76 || bytes[3] !== 70 || bytes[4] !== 2 || bytes[5] !== 1) return false;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint16(18, true) !== 183) return false;
    const offset = Number(view.getBigUint64(32, true));
    const size = view.getUint16(54, true), count = view.getUint16(56, true);
    if (!Number.isSafeInteger(offset) || offset < 64 || size < 56 || !count || offset + size * count > bytes.length) return false;
    let loads = 0;
    for (let index = 0; index < count; index++) {
      const start = offset + size * index;
      if (view.getUint32(start, true) !== 1) continue;
      loads++;
      const alignment = view.getBigUint64(start + 48, true);
      if (alignment < 16384n || (alignment & (alignment - 1n)) !== 0n
        || (view.getBigUint64(start + 16, true) - view.getBigUint64(start + 8, true)) % 16384n !== 0n) return false;
    }
    return loads > 0;
  } catch { return false; }
}
