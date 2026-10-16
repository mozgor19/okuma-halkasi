import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { evaluateRelease, publicHttpsOrigin, checkManifest, checkSignature, elfSupports16k } from "../release-gate.mjs";
import { loopbackOrigin } from "../test-environment.mjs";
import appConfig from "../../mobile/app.config.ts";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const policy = JSON.parse(readFileSync(new URL("../../release/android-policy.json", import.meta.url), "utf8"));
const now = Date.parse("2026-10-17T12:00:00Z");
function fixture() {
  const source = { commit: "a".repeat(40), sourceDigest: "b".repeat(64), dirty: false };
  const evidence = { schemaVersion: 1, ...source, artifactSha256: "c".repeat(64), uploadCertificateSha256: "d".repeat(64), appOrigin: "https://app.example.com", versionCode: 2, previousVersionCode: 1,
    approvals: Object.fromEntries(policy.manualChecks.map(({ id }) => [id, { status: "passed", by: "QA reviewer", at: new Date(now).toISOString(), evidence: "internal-ticket/123" }])) };
  const report = (platform, steps) => ({ schemaVersion: 1, ...source, status: "passed", platform, startedAt: new Date(now - 60_000).toISOString(), finishedAt: new Date(now).toISOString(), steps: steps.map((id) => ({ id, status: "passed" })) });
  return { policy: structuredClone(policy), source, evidence, webReport: report("web", policy.webSteps), androidReport: report("android-emulator", policy.androidSteps), now,
    artifactChecks: ["aab", "signature", "manifest", "arm64", "elf-alignment", "bundle-origin"].map((id) => ({ id, status: "passed" })) };
}

test("Only a complete current candidate can pass the evaluator", () => {
  assert.equal(evaluateRelease(fixture()).status, "ready-for-manual-submission");
});
for (const [label, mutate] of [
  ["missing evidence", (f) => { f.evidence = null; }],
  ["dirty source", (f) => { f.source.dirty = true; }],
  ["old commit", (f) => { f.evidence.commit = "f".repeat(40); }],
  ["wrong source digest", (f) => { f.webReport.sourceDigest = "f".repeat(64); }],
  ["dirty test report", (f) => { f.webReport.dirty = true; }],
  ["missing Android report", (f) => { f.androidReport = null; }],
  ["web passed in place of Android", (f) => { f.androidReport.platform = "web"; }],
  ["missing step", (f) => { f.webReport.steps.pop(); }],
  ["failed step despite passed summary", (f) => { f.androidReport.steps[0].status = "failed"; }],
  ["old test report", (f) => { f.webReport.finishedAt = "2026-01-01"; }],
  ["future report", (f) => { f.webReport.finishedAt = "2027-01-01"; }],
  ["invalid report date", (f) => { f.webReport.finishedAt = "never"; }],
  ["non-increasing version", (f) => { f.evidence.versionCode = 1; }],
  ["fractional version", (f) => { f.evidence.versionCode = 2.2; }],
  ["missing artifact hash", (f) => { f.evidence.artifactSha256 = ""; }],
  ["pending manual approval", (f) => { f.evidence.approvals.staging.status = "pending"; }],
  ["missing reviewer", (f) => { f.evidence.approvals.staging.by = ""; }],
  ["missing proof", (f) => { f.evidence.approvals.staging.evidence = ""; }],
  ["expired manual proof", (f) => { f.evidence.approvals.staging.at = "2026-01-01"; }],
  ["missing artifact inspection", (f) => { f.artifactChecks = []; }],
  ["expired Play policy review", (f) => { f.policy.reviewBy = "2026-01-01"; }],
]) test(`Release is blocked: ${label}`, () => {
  const f = fixture(); mutate(f);
  assert.equal(evaluateRelease(f).status, "not-ready");
});

for (const value of ["http://app.example.com", "https://localhost", "https://127.0.0.1", "https://10.1.2.3", "https://172.16.1.2", "https://192.168.1.2", "https://[::1]", "https://app.invalid", "https://app.test", "https://app.local", "https://user:secret@app.example.com", "https://app.example.com/path", "https://app.example.com?x=1", "invalid"]) {
  test(`Nonproduction origin is rejected: ${value}`, () => assert.equal(publicHttpsOrigin(value), false));
}
test("Test origins never point at production", () => {
  assert.equal(loopbackOrigin("http://127.0.0.1:5184"), "http://127.0.0.1:5184");
  for (const value of ["https://app.example.com", "http://192.168.1.1", "http://localhost/anything", "http://user:pass@localhost"]) assert.throws(() => loopbackOrigin(value));
});

function manifest() {
  return { manifest: { $: { package: policy.applicationId, "android:versionCode": "2" }, "uses-sdk": [{ $: { "android:targetSdkVersion": "36" } }], application: [{ $: { "android:allowBackup": "false" } }], "uses-permission": [{ $: { "android:name": "android.permission.CAMERA" } }] } };
}
test("Release manifest accepts the intended secure package", () => assert.equal(checkManifest(manifest(), policy, fixture().evidence), true));
for (const key of ["android:debuggable", "android:testOnly", "android:usesCleartextTraffic"]) test(`Release manifest rejects ${key}`, () => {
  const m = manifest(); m.manifest.application[0].$[key] = "true";
  assert.equal(checkManifest(m, policy, fixture().evidence), false);
});
for (const permission of policy.forbiddenPermissions) test(`Restricted manifest permission rejected: ${permission}`, () => {
  const m = manifest(); m.manifest["uses-permission"].push({ $: { "android:name": permission } });
  assert.equal(checkManifest(m, policy, fixture().evidence), false);
});
test("Wrong package, SDK, version, backups and custom network security cannot pass", () => {
  for (const modify of [
    (m) => { m.manifest.$.package += ".test"; },
    (m) => { m.manifest.$["android:versionCode"] = "1"; },
    (m) => { m.manifest["uses-sdk"][0].$["android:targetSdkVersion"] = "35"; },
    (m) => { delete m.manifest.application[0].$["android:allowBackup"]; },
    (m) => { m.manifest.application[0].$["android:networkSecurityConfig"] = "@xml/unknown"; },
  ]) { const m = manifest(); modify(m); assert.equal(checkManifest(m, policy, fixture().evidence), false); }
});

function elf(alignment = 16384n) {
  const bytes = new Uint8Array(120);
  bytes.set([0x7f, 69, 76, 70, 2, 1]);
  const view = new DataView(bytes.buffer);
  view.setUint16(18, 183, true); view.setBigUint64(32, 64n, true); view.setUint16(54, 56, true); view.setUint16(56, 1, true);
  view.setUint32(64, 1, true); view.setBigUint64(112, alignment, true);
  return bytes;
}
test("ARM64 ELF checks every LOAD segment at 16 KB", () => {
  assert.equal(elfSupports16k(elf()), true);
  assert.equal(elfSupports16k(elf(65536n)), true);
  for (const n of [0n, 4096n, 20000n]) assert.equal(elfSupports16k(elf(n)), false);
  assert.equal(elfSupports16k(new Uint8Array(10)), false);
  const unaligned = elf(); new DataView(unaligned.buffer).setBigUint64(64 + 16, 4096n, true);
  assert.equal(elfSupports16k(unaligned), false);
  const x64 = elf(); new DataView(x64.buffer).setUint16(18, 62, true);
  assert.equal(elfSupports16k(x64), false);
  const truncated = elf(); new DataView(truncated.buffer).setUint16(56, 500, true);
  assert.equal(elfSupports16k(truncated), false);
});

test("Signature verification never accepts unsigned additions or debug/expired certificates", () => {
  const certificate = { subject: "CN=Upload", fingerprint256: "a".repeat(64), validFrom: "2026-01-01", validTo: "2027-01-01" };
  const valid = { status: 4, certificateCount: 1, stdout: "jar verified, with signer errors.", stderr: "self signed" };
  assert.equal(checkSignature(valid, certificate, "a".repeat(64), now), true);
  assert.equal(checkSignature({ status: 0, certificateCount: 1, stdout: "jar verified." }, certificate, "a".repeat(64), now), true);
  for (const result of [
    { ...valid, status: 20 }, { ...valid, status: 8 }, { ...valid, status: null }, { ...valid, certificateCount: 2 },
    { ...valid, stdout: "jar is unsigned." }, { ...valid, stdout: "jar verified. unsigned entries" },
    { ...valid, stderr: "disabled algorithm" },
  ]) assert.equal(checkSignature(result, certificate, "a".repeat(64), now), false);
  for (const extra of [{ subject: "CN=Android Debug" }, { validTo: "2025-01-01" }, { validFrom: "2027-01-01" }, { fingerprint256: "b".repeat(64) }]) assert.equal(checkSignature(valid, { ...certificate, ...extra }, "a".repeat(64), now), false);
});

function config(environment) {
  const keys = ["NODE_ENV", "EAS_BUILD", "EAS_BUILD_PROFILE", "OKUMA_MOBILE_CHANNEL", "EXPO_PUBLIC_APP_URL", "OKUMA_ANDROID_VERSION_CODE"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, environment);
    return appConfig({ config: { name: "Okuma", slug: "okuma", android: { package: policy.applicationId } } });
  } finally { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } }
}
test("Test and staging applications cannot replace the production app", () => {
  assert.equal(config({ OKUMA_MOBILE_CHANNEL: "test" }).android.package, policy.applicationId + ".test");
  assert.equal(config({ OKUMA_MOBILE_CHANNEL: "staging", EXPO_PUBLIC_APP_URL: "https://stage.example.com" }).android.package, policy.applicationId + ".staging");
});
test("Production config requires a public HTTPS host and valid versionCode", () => {
  for (const extra of [{}, { EXPO_PUBLIC_APP_URL: "http://127.0.0.1:5174" }, { EXPO_PUBLIC_APP_URL: "https://app.invalid" }, { EXPO_PUBLIC_APP_URL: "https://192.168.1.1" }, { OKUMA_MOBILE_CHANNEL: "test" }, { EXPO_PUBLIC_APP_URL: "https://app.example.com", OKUMA_ANDROID_VERSION_CODE: "0" }]) assert.throws(() => config({ NODE_ENV: "production", ...extra }));
  const c = config({ NODE_ENV: "production", EXPO_PUBLIC_APP_URL: "https://app.example.com", OKUMA_ANDROID_VERSION_CODE: "10" });
  assert.equal(c.android.package, policy.applicationId);
  assert.equal(c.android.versionCode, 10);
  assert.ok(c.android.blockedPermissions.includes("android.permission.SYSTEM_ALERT_WINDOW"));
});

test("CI has independent required web/native jobs, pinned actions and no publication credentials", () => {
  const require = createRequire(import.meta.url);
  const eslintRequire = createRequire(require.resolve("eslint/package.json"));
  const yaml = eslintRequire("js-yaml");
  const workflow = yaml.load(readFileSync(new URL("../../.github/workflows/release-tests.yml", import.meta.url), "utf8"));
  assert.equal(workflow.permissions.contents, "read");
  assert.ok(workflow.on.pull_request !== undefined);
  assert.deepEqual(workflow.jobs.gate.needs, ["web", "android"]);
  assert.equal(workflow.jobs.gate.name, "Release Regression Gate");
  for (const job of Object.values(workflow.jobs)) for (const step of job.steps) {
    if (step.uses) assert.match(step.uses, /^[^@]+@[a-f0-9]{40}$/);
    assert.ok(!JSON.stringify(step).includes("secrets."));
  }
});
test("Native prebuild template is exact and matches the pinned Expo SDK", () => {
  const mobile = JSON.parse(readFileSync(new URL("../../mobile/package.json", import.meta.url), "utf8"));
  assert.match(policy.nativeTemplate, /^expo-template-bare-minimum@\d+\.\d+\.\d+$/);
  assert.equal(policy.nativeTemplate.split("@")[1].split(".")[0], mobile.dependencies.expo.split(".")[0]);
  const eas = JSON.parse(readFileSync(new URL("../../mobile/eas.json", import.meta.url), "utf8"));
  for (const profile of Object.values(eas.build)) {
    assert.equal(profile.prebuildCommand, "prebuild --template " + policy.nativeTemplate);
    assert.equal(profile.pnpm, "11.25.0");
    assert.ok(Number(profile.node.split(".")[0]) >= 24);
  }
});
test("Test namespace is isolated and path traversal is rejected", () => {
  const script = 'import { groupsStatePath, testOrigin } from "./scripts/test-environment.mjs"; console.log(JSON.stringify({ groupsStatePath, testOrigin }));';
  const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", env: { ...process.env, OKUMA_TEST_RUN_ID: "isolated-check", OKUMA_TEST_ORIGIN: "http://127.0.0.1:5184" } }));
  assert.ok(result.groupsStatePath.endsWith("/.sites-runtime/release-tests/isolated-check/state"));
  assert.equal(result.testOrigin, "http://127.0.0.1:5184");
  assert.throws(() => execFileSync(process.execPath, ["--input-type=module", "-e", script], { stdio: "pipe", env: { ...process.env, OKUMA_TEST_RUN_ID: "../../escape" } }));
});
