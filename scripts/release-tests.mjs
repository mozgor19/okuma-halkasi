import { spawn } from "node:child_process";
import { mkdirSync, openSync, closeSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import { sourceIdentity } from "./release-source.mjs";

const android = process.argv.includes("--android");
if (process.argv.slice(2).some((arg) => arg !== "--android")) throw new Error("Only --android is supported.");
// Each run has its own synthetic D1s, credentials and reports. Existing developer data is never reset.
process.env.OKUMA_TEST_RUN_ID ||= `${android ? "android" : "web"}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const { testOrigin, legacyOrigin, testOutputRoot, testRunId, groupsStatePath, groupsSeedPath } = await import("./test-environment.mjs");
if (existsSync(groupsStatePath) || existsSync(groupsSeedPath) || existsSync(testOutputRoot)) throw new Error("Test run already exists; choose a fresh OKUMA_TEST_RUN_ID. No data was reset.");
mkdirSync(testOutputRoot, { recursive: true });
const report = { schemaVersion: 1, platform: android ? "android-emulator" : "web", ...sourceIdentity(), startedAt: new Date().toISOString(), runId: testRunId, status: "running", steps: [] };
const reportPath = `${testOutputRoot}/suite-report.json`;
const children = new Set();
const env = { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1", WRANGLER_SEND_METRICS: "false", CLOUDFLARE_CF_FETCH_ENABLED: "false" };
delete env.CLOUDFLARE_API_TOKEN;
delete env.CLOUDFLARE_API_KEY;
delete env.OKUMA_GROUPS_DEVELOPMENT;
function persist() { writeFileSync(reportPath, JSON.stringify(report, null, 2)); }
persist();

function launch(args, overrides = {}, log) {
  const fd = log ? openSync(`${testOutputRoot}/${log}.log`, "a", 0o600) : null;
  const child = spawn(args[0], args.slice(1), { env: { ...env, ...overrides }, stdio: fd === null ? "inherit" : ["ignore", fd, fd], detached: process.platform !== "win32" });
  if (fd !== null) closeSync(fd);
  children.add(child);
  child.once("exit", () => children.delete(child));
  child.once("error", () => children.delete(child));
  return child;
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  const signal = (value) => { try { if (process.platform === "win32") child.kill(value); else process.kill(-child.pid, value); } catch (error) { if (error.code !== "ESRCH") throw error; } };
  signal("SIGTERM");
  const timer = setTimeout(() => signal("SIGKILL"), 8_000);
  await exited;
  clearTimeout(timer);
}
async function run(id, args, overrides = {}) {
  console.log(`\nRelease test: ${id}`);
  const step = { id, status: "running", startedAt: new Date().toISOString() };
  report.steps.push(step); persist();
  const child = launch(args, overrides);
  const timer = setTimeout(() => { void stop(child); }, 20 * 60_000);
  try {
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
    if (code !== 0) throw new Error(`${id} failed (${code ?? "signal"}).`);
    step.status = "passed";
  } catch (error) { step.status = "failed"; throw error; }
  finally { clearTimeout(timer); step.finishedAt = new Date().toISOString(); persist(); }
}
const node = (file, ...args) => [process.execPath, file, ...args];
const pnpm = (...args) => ["corepack", "pnpm", ...args];

async function freePort(origin) {
  const url = new URL(origin);
  if (url.hostname !== "127.0.0.1") throw new Error("Managed release tests bind only 127.0.0.1.");
  const server = createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(Number(url.port), url.hostname, resolve); });
  await new Promise((resolve) => server.close(resolve));
}
async function server(legacy = false, selfService = false) {
  const origin = legacy ? legacyOrigin : testOrigin;
  await freePort(origin);
  const child = launch(node("node_modules/vite/bin/vite.js", "--port", new URL(origin).port), { OKUMA_GROUPS_DEVELOPMENT: legacy ? "legacy" : "1", OKUMA_SELF_SERVICE_DEVELOPMENT: selfService ? "1" : "0" }, legacy ? "legacy-server" : selfService ? "self-service-server" : "main-server");
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error("Test server exited; inspect its log.");
    try { const response = await fetch(origin + "/login", { signal: AbortSignal.timeout(3_000) }); if (response.ok) return child; } catch { /* Server compilation is bounded by this loop. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Test server did not become ready.");
}

for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
  report.status = "interrupted"; persist();
  void Promise.all([...children].map(stop)).finally(() => process.exit(130));
});

try {
  await run("fixtures", node("scripts/groups-development.mjs"));
  if (android) {
    const serial = process.env.OKUMA_ANDROID_SERIAL || "emulator-5554";
    if (!/^emulator-\d+$/.test(serial)) throw new Error("Automated Android suite may only modify an emulator.");
    const { join } = await import("node:path");
    const { homedir } = await import("node:os");
    const adb = join(process.env.ANDROID_HOME || join(homedir(), "Android/Sdk"), "platform-tools/adb");
    const mobileEnv = { OKUMA_MOBILE_CHANNEL: "test", EXPO_PUBLIC_APP_URL: testOrigin, NODE_ENV: "development", OKUMA_ANDROID_PACKAGE: "com.okumahalkasi.app.test", OKUMA_ANDROID_SERIAL: serial, OKUMA_METRO_PORT: "8083" };
    Object.assign(env, mobileEnv);
    await run("android-device", [adb, "-s", serial, "wait-for-device"]);
    const template = JSON.parse(readFileSync("release/android-policy.json", "utf8")).nativeTemplate;
    if (!/^expo-template-bare-minimum@\d+\.\d+\.\d+$/.test(template)) throw new Error("Use an exact reviewed native template version.");
    await run("android-prebuild", pnpm("--dir", "mobile", "exec", "expo", "prebuild", "--platform", "android", "--no-install", "--template", template), mobileEnv);
    // Gradle's autolinking cache does not notice an app.config package/channel change.
    for (const directory of ["mobile/android/build/generated/autolinking", "mobile/android/app/build/generated/autolinking"]) rmSync(directory, { recursive: true, force: true });
    await run("android-build", ["bash", "mobile/android/gradlew", "-p", "mobile/android", ":app:assembleDebug", "-PreactNativeArchitectures=x86_64", "-PreactNativeDevServerPort=8083", "--max-workers=2", "--no-daemon"], mobileEnv);
    const backend = await server();
    await freePort("http://127.0.0.1:8083");
    const metro = launch(pnpm("--dir", "mobile", "exec", "expo", "start", "--port", "8083", "--localhost"), mobileEnv, "metro");
    for (let attempt = 0; ; attempt++) {
      try { if ((await fetch("http://127.0.0.1:8083/status")).ok) break; } catch { /* Metro startup. */ }
      if (attempt >= 120 || metro.exitCode !== null) throw new Error("Test Metro did not become ready.");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    for (const port of [new URL(testOrigin).port, "8083"]) await run(`android-reverse-${port}`, [adb, "-s", serial, "reverse", `tcp:${port}`, `tcp:${port}`]);
    await run("android-install", [adb, "-s", serial, "install", "-r", "mobile/android/app/build/outputs/apk/debug/app-debug.apk"]);
    await run("android-open", [adb, "-s", serial, "shell", "am", "start", "-n", mobileEnv.OKUMA_ANDROID_PACKAGE + "/.MainActivity"]);
    for (const [id, file] of [["android-shell", "shell"], ["android-media", "media"], ["android-notifications", "notifications"]]) await run(id, node(`scripts/test-android-${file}.mjs`));
    await stop(metro); await stop(backend);
  } else {
    await run("release-unit", pnpm("test:release:unit"));
    await run("backend-unit", pnpm("groups:test:unit"));
    await run("mobile-policy", pnpm("--dir", "mobile", "test"));
    await run("web-types", pnpm("exec", "tsc", "--noEmit"));
    await run("mobile-types", pnpm("mobile:typecheck"));
    await run("ui-contract", pnpm("check:ui"));
    await run("lint", pnpm("lint"));
    await run("web-build", pnpm("build"));
    const backend = await server();
    await run("api", pnpm("groups:test"));
    await run("web-ui", pnpm("groups:test:ui"));
    await run("branding", pnpm("groups:test:branding"));
    // Separate server processes share local SQLite files. Only one writes at a time.
    await stop(backend);
    const legacy = await server(true);
    await run("legacy", pnpm("groups:test:legacy"));
    const main = await server();
    await run("memberships", pnpm("groups:test:memberships"));
    await stop(main); await stop(legacy);
    const onboarding = await server(false, true);
    await run("self-service", pnpm("self-service:test"));
    await stop(onboarding);
  }
  const after = sourceIdentity();
  if (after.commit !== report.commit || after.sourceDigest !== report.sourceDigest) throw new Error("Source changed during tests; rerun against one fixed revision.");
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await Promise.all([...children].map(stop));
  report.finishedAt = new Date().toISOString(); persist();
  console.log(`\n${report.status.toUpperCase()}: ${reportPath}`);
  console.log("Automated tests are not Google Play approval or a signed release-candidate device test.");
}
