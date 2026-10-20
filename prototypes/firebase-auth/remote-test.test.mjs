import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { newRemoteTestState, assertRemoteTestState, remoteTestService, remoteTestSummary, testRecipient } from "./remote-test-policy.mjs";
import { testProject } from "./test-project-policy.mjs";

const config = { apiKey: "AIza" + "x".repeat(35), projectId: testProject.projectId, authDomain: testProject.authDomain, appId: testProject.appId };
const nextPassword = "Only-This-Test-Password-7428!";
function fixture(patch = {}) {
  const state = newRemoteTestState(), calls = [], saved = [], sessions = new Map(), refreshes = new Map();
  const flags = { ...patch };
  let user = null, sequence = 0, cutoff = 0;
  const error = (code, status = 400) => Response.json({ error: { message: code } }, { status });
  const session = () => {
    const serial = ++sequence, idToken = "synthetic-private-id-token-" + serial, refreshToken = "synthetic-private-refresh-token-" + serial;
    const identity = { uid: user.uid, verified: user.emailVerified, authTime: cutoff ? 3 : 1 };
    sessions.set(idToken, identity); refreshes.set(refreshToken, identity);
    return { localId: user.uid, email: testRecipient, idToken, refreshToken };
  };
  const request = async (input, init) => {
    const url = new URL(input), refresh = url.hostname === "securetoken.googleapis.com";
    assert.equal(url.origin, refresh ? "https://securetoken.googleapis.com" : "https://identitytoolkit.googleapis.com");
    assert.equal(url.searchParams.get("key"), config.apiKey);
    assert.deepEqual([...url.searchParams.keys()], ["key"]);
    assert.equal(init.method, "POST"); assert.equal(init.redirect, "error"); assert.equal(init.credentials, "omit"); assert.equal(init.cache, "no-store");
    assert.equal(init.headers.Authorization, undefined); assert.equal(init.headers["X-Firebase-Locale"], "tr");
    const body = refresh ? Object.fromEntries(new URLSearchParams(init.body)) : JSON.parse(init.body);
    const operation = refresh ? "refresh" : url.pathname.replace("/v1/accounts:", "");
    calls.push({ operation, body });
    if (flags.privateFailure) throw Error("Private token " + init.body);
    if (operation === "signUp") {
      if (flags.existing) return error("EMAIL_EXISTS");
      assert.equal(user, null); assert.equal(body.email, testRecipient);
      user = { uid: "synthetic-owned-uid", password: body.password, displayName: body.displayName, emailVerified: false, deleted: false };
      return Response.json(session());
    }
    if (operation === "signInWithPassword") {
      assert.equal(body.email, testRecipient);
      if (!user || user.deleted) return error("EMAIL_NOT_FOUND");
      if (flags.quotaOnWrong && body.password !== user.password) return error("TOO_MANY_ATTEMPTS_TRY_LATER", 429);
      if (body.password !== user.password && !flags.acceptWrongPassword) return error("INVALID_LOGIN_CREDENTIALS");
      const data = session(); if (flags.changedUid) data.localId = "some-other-uid";
      return Response.json(data);
    }
    if (operation === "refresh") {
      const identity = refreshes.get(body.refresh_token);
      if (!user || user.deleted) return error("USER_NOT_FOUND");
      if (!identity || identity.authTime < cutoff) return error("TOKEN_EXPIRED");
      const data = session();
      return Response.json({ user_id: flags.changedRefreshUid ? "other-uid" : user.uid, project_id: testProject.projectNumber,
        id_token: data.idToken, refresh_token: data.refreshToken });
    }
    const identity = sessions.get(body.idToken);
    if (operation === "lookup") {
      if (!user || user.deleted) return error("USER_NOT_FOUND");
      if (flags.expiredToken === body.idToken || !identity || identity.authTime < cutoff) return error("TOKEN_EXPIRED");
      return Response.json({ users: [{ localId: user.uid, email: testRecipient, emailVerified: user.emailVerified,
        displayName: flags.wrongMarker ? "Unrelated account" : user.displayName, validSince: String(cutoff) }] });
    }
    if (operation === "sendOobCode") {
      if (flags.mailFailure) throw Error("Ambiguous private provider failure");
      if (body.requestType === "VERIFY_EMAIL") assert.ok(identity);
      else { assert.equal(body.requestType, "PASSWORD_RESET"); assert.equal(body.email, testRecipient); }
      return Response.json({ email: flags.wrongMailRecipient ? "other@example.invalid" : testRecipient });
    }
    if (operation === "delete") {
      assert.ok(identity); assert.equal(identity.uid, user.uid); user.deleted = true;
      if (flags.ambiguousDelete) { flags.ambiguousDelete = false; throw Error("Ambiguous private deletion response"); }
      return Response.json({});
    }
    assert.fail("Unexpected synthetic operation");
  };
  const verify = async (value) => {
    const identity = sessions.get(value);
    if (!identity || !identity.verified || identity.authTime < cutoff || user.deleted) throw Error("AUTH_IDENTITY_UNAVAILABLE");
    return { uid: identity.uid, authTime: identity.authTime };
  };
  const signed = async (value) => {
    const identity = sessions.get(value);
    if (!identity?.verified) throw Error("INVALID_IDENTITY");
    return { uid: identity.uid, authTime: identity.authTime };
  };
  const otherProject = async () => { throw Object.assign(Error("Wrong project"), { code: "ERR_JWT_CLAIM_VALIDATION_FAILED" }); };
  const persist = async (value) => { if (flags.persistFailure) throw Error("Synthetic disk failure"); saved.push(structuredClone(value)); };
  const service = remoteTestService(config, state, persist, { request, verify, signed, otherProject });
  return { state, service, calls, saved, flags, sessions, verifyEmail() { user.emailVerified = true; },
    reset() { user.password = nextPassword; cutoff = 2; }, user: () => user };
}

test("only the approved project/app/recipient and well-formed private state can run", () => {
  const good = newRemoteTestState(); assertRemoteTestState(good);
  assert.equal(good.recipient, testRecipient); assert.equal(good.phase, "prepared");
  for (const change of [{ projectId: "koru-production" }, { recipient: "someone-else@example.invalid" }, { appId: "other" },
    { runId: "invalid" }, { phase: "admin" }, { checks: ["private@example.invalid"] }, { attempts: {} }, { credentials: { password: "weak" } }])
    assert.throws(() => assertRemoteTestState({ ...good, ...change }), /STATE_REJECTED/);
  assert.throws(() => remoteTestService({ ...config, projectId: "koru-mail" }, good, () => {}), /CONFIG_REJECTED/);
});
test("successful isolated lifecycle checks real contracts in order and deletes only the nonce-owned synthetic account", async () => {
  const ctx = fixture(); await ctx.service.start();
  assert.equal(ctx.state.phase, "awaiting-verification");
  assert.ok(ctx.state.checks.includes("wrong-password-rejected"));
  assert.ok(ctx.state.checks.includes("unverified-signed-token-rejected"));
  ctx.verifyEmail(); await ctx.service.verified();
  assert.equal(ctx.state.phase, "awaiting-reset");
  ctx.reset(); await ctx.service.finish(nextPassword);
  assert.equal(ctx.state.phase, "complete"); assert.equal(ctx.state.credentials, undefined); assert.equal(ctx.user().deleted, true);
  const mails = ctx.calls.filter((item) => item.operation === "sendOobCode");
  assert.deepEqual(mails.map((item) => item.body.requestType), ["VERIFY_EMAIL", "PASSWORD_RESET"]);
  assert.equal(ctx.calls.filter((item) => item.operation === "signUp").length, 1);
  const before = ctx.calls.length; await ctx.service.cleanup(); assert.equal(ctx.calls.length, before);
  for (const name of ["verified-signed-token-and-provider-status", "old-password-rejected-after-reset", "old-refresh-rejected-after-reset", "old-signed-token-rejected-after-reset", "owned-test-account-deleted"])
    assert.ok(ctx.state.checks.includes(name));
  const report = JSON.stringify(remoteTestSummary(ctx.state));
  assert.doesNotMatch(report, /synthetic-owned-uid|synthetic-private|Koru-Test-A8|passwordHash|AIza/);
});
test("existing email rejects signup and can never be recovered, reset or deleted by the tool", async () => {
  const ctx = fixture({ existing: true });
  await assert.rejects(ctx.service.start(), (error) => error.providerCode === "EMAIL_EXISTS");
  await assert.rejects(ctx.service.start(), /CREATE_ALREADY_ATTEMPTED/);
  await assert.rejects(ctx.service.cleanup(), /OWNERSHIP_REQUIRED/);
  assert.deepEqual(ctx.calls.map((item) => item.operation), ["signUp"]);
});
test("before confirmation, pending email cannot advance to password reset", async () => {
  const ctx = fixture(); await ctx.service.start();
  await assert.rejects(ctx.service.verified(), /EMAIL_NOT_VERIFIED_YET/);
  assert.equal(ctx.calls.filter((item) => item.operation === "sendOobCode").length, 1);
  assert.equal(ctx.state.phase, "awaiting-verification");
});
test("completed signup/mail operations cannot be re-sent by repeating a command", async () => {
  const ctx = fixture(); await ctx.service.start();
  await assert.rejects(ctx.service.start(), /CREATE_ALREADY_ATTEMPTED/);
  ctx.verifyEmail(); await ctx.service.verified();
  await assert.rejects(ctx.service.verified(), /VERIFICATION_PHASE_REQUIRED/);
  assert.equal(ctx.calls.filter((item) => item.operation === "signUp").length, 1);
  assert.equal(ctx.calls.filter((item) => item.operation === "sendOobCode").length, 2);
});
test("ambiguous mail is durably attempted once and never silently retried", async () => {
  const ctx = fixture({ mailFailure: true });
  await assert.rejects(ctx.service.start(), /NETWORK_AMBIGUOUS/);
  assert.equal(ctx.state.attempts.verification, true);
  assert.equal(ctx.saved.at(-1).attempts.verification, true);
  await assert.rejects(ctx.service.start(), /CREATE_ALREADY_ATTEMPTED/);
  assert.equal(ctx.calls.filter((item) => item.operation === "sendOobCode").length, 1);
  ctx.flags.mailFailure = false; await ctx.service.cleanup(); assert.equal(ctx.user().deleted, true);
});
test("UID/marker mismatches and unexpected mail recipient cannot authorize unrelated changes", async () => {
  const ctx = fixture(); await ctx.service.start(); ctx.verifyEmail();
  ctx.flags.changedUid = true; await assert.rejects(ctx.service.verified(), /IDENTITY_MISMATCH/);
  ctx.flags.changedUid = false; ctx.flags.wrongMarker = true;
  await assert.rejects(ctx.service.cleanup(), /OWNERSHIP_MISMATCH/);
  assert.equal(ctx.calls.filter((item) => item.operation === "delete").length, 0);
  const second = fixture({ wrongMailRecipient: true }); await assert.rejects(second.service.start(), /MAIL_RECIPIENT_MISMATCH/);
});
test("quota/provider outages do not count as wrong-password rejection and never expose bodies", async () => {
  const quota = fixture({ quotaOnWrong: true });
  await assert.rejects(quota.service.start(), (error) => error.status === 429 && error.providerCode === "TOO_MANY_ATTEMPTS_TRY_LATER");
  assert.ok(!quota.state.checks.includes("wrong-password-rejected"));
  assert.equal(quota.calls.filter((item) => item.operation === "sendOobCode").length, 0);
  const outage = fixture({ privateFailure: true });
  await assert.rejects(outage.service.start(), (error) => error.message === "FIREBASE_REMOTE_TEST_NETWORK_AMBIGUOUS" && error.cause === undefined);
  await assert.rejects(outage.service.start(), /CREATE_ALREADY_ATTEMPTED/);
});
test("a successful wrong-password login fails the check instead of being misreported as rejected", async () => {
  const ctx = fixture({ acceptWrongPassword: true });
  await assert.rejects(ctx.service.start(), /EXPECTED_DENIAL/);
  assert.equal(ctx.calls.filter((item) => item.operation === "sendOobCode").length, 0);
});
test("a persistence error before creation prevents any network mutation", async () => {
  const ctx = fixture({ persistFailure: true });
  await assert.rejects(ctx.service.start(), /Synthetic disk failure/);
  assert.equal(ctx.calls.length, 0);
});
test("cleanup refreshes an expired owned credential but rejects another returned identity", async () => {
  const ctx = fixture(); await ctx.service.start(); ctx.flags.expiredToken = ctx.state.credentials.idToken;
  await ctx.service.cleanup(); assert.equal(ctx.state.phase, "cleaned"); assert.equal(ctx.user().deleted, true);
  const other = fixture(); await other.service.start(); other.flags.expiredToken = other.state.credentials.idToken; other.flags.changedRefreshUid = true;
  await assert.rejects(other.service.cleanup(), /REFRESH_IDENTITY_MISMATCH/);
  assert.equal(other.calls.filter((item) => item.operation === "delete").length, 0);
});
test("an ambiguous delete is confirmed on retry without creating or deleting another account", async () => {
  const ctx = fixture({ ambiguousDelete: true }); await ctx.service.start();
  await assert.rejects(ctx.service.cleanup(), /NETWORK_AMBIGUOUS/);
  assert.equal(ctx.state.attempts.delete, true); assert.equal(ctx.user().deleted, true);
  await ctx.service.cleanup(); assert.equal(ctx.state.phase, "cleaned");
  assert.equal(ctx.calls.filter((item) => item.operation === "delete").length, 1);
});
test("a reset must really occur with a different private password before finish/deletion", async () => {
  const ctx = fixture(); await ctx.service.start(); ctx.verifyEmail(); await ctx.service.verified();
  await assert.rejects(ctx.service.finish(ctx.state.credentials.password), /NEW_TEST_PASSWORD_REQUIRED/);
  await assert.rejects(ctx.service.finish(nextPassword), (error) => error.providerCode === "INVALID_LOGIN_CREDENTIALS");
  assert.equal(ctx.calls.filter((item) => item.operation === "delete").length, 0);
});
test("remote entry point refuses missing approval, arbitrary accounts/projects and passwords in arguments", () => {
  for (const args of [[], ["start"], ["start", "--confirm=wrong"], ["start", "--confirm=spark-isolated-account-test", "--email=other@example.invalid"],
    ["finish", "--confirm=spark-isolated-account-test", "--password=private"]]) {
    const result = spawnSync(process.execPath, [new URL("./remote-test.mjs", import.meta.url).pathname, ...args], { encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 1); assert.equal(result.stdout, "");
    assert.match(result.stderr, /EXPLICIT_APPROVAL_REQUIRED/);
    assert.doesNotMatch(result.stderr, /other@example|--password|AIza|PRIVATE KEY/);
  }
});
