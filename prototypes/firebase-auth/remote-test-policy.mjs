import { randomBytes, randomUUID } from "node:crypto";
import { approvedTestConfig, testProject } from "./test-project-policy.mjs";
import { readProviderJson } from "./provider-http.mjs";
import { signedTokenVerifier } from "./identity-contract.mjs";
import { providerCheckedVerifier } from "./provider-status.mjs";

export const testRecipient = "koru.destek+firebase-test@gmail.com";
const deniedLogin = ["INVALID_LOGIN_CREDENTIALS", "INVALID_PASSWORD", "EMAIL_NOT_FOUND", "USER_NOT_FOUND"];
const deniedToken = ["USER_NOT_FOUND", "INVALID_ID_TOKEN", "TOKEN_EXPIRED", "INVALID_REFRESH_TOKEN"];
const safeCodes = new Set([...deniedLogin, ...deniedToken, "EMAIL_EXISTS", "USER_DISABLED", "TOO_MANY_ATTEMPTS_TRY_LATER", "OPERATION_NOT_ALLOWED", "WEAK_PASSWORD", "MISSING_PASSWORD", "INVALID_EMAIL"]);
const fail = (code) => { throw Error("FIREBASE_REMOTE_TEST_" + code); };
const check = (value, code) => { if (!value) fail(code); };

export function newRemoteTestState() {
  return { version: 1, runId: randomUUID(), projectId: testProject.projectId, appId: testProject.appId,
    recipient: testRecipient, phase: "prepared", createdAt: Date.now(), attempts: { create: false, verification: false, reset: false, delete: false },
    checks: [], credentials: { password: "Koru-Test-A8!" + randomBytes(24).toString("base64url") } };
}
export function assertRemoteTestState(state) {
  check(state?.version === 1 && state.projectId === testProject.projectId && state.appId === testProject.appId
    && state.recipient === testRecipient && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(state.runId)
    && Number.isSafeInteger(state.createdAt) && state.createdAt > 0 && state.createdAt <= Date.now() + 10000
    && ["prepared", "created", "awaiting-verification", "verified", "awaiting-reset", "cleaning", "complete", "cleaned"].includes(state.phase)
    && ["create", "verification", "reset", "delete"].every((key) => typeof state.attempts?.[key] === "boolean")
    && Array.isArray(state.checks) && state.checks.length <= 30 && state.checks.every((value) => /^[a-z-]{1,80}$/.test(value))
    && new Set(state.checks).size === state.checks.length, "STATE_REJECTED");
  if (!["complete", "cleaned"].includes(state.phase)) check(state.credentials && typeof state.credentials.password === "string"
    && /^Koru-Test-A8![A-Za-z0-9_-]{32}$/.test(state.credentials.password), "STATE_REJECTED");
  if (state.credentials?.uid !== undefined) check(typeof state.credentials.uid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(state.credentials.uid), "STATE_REJECTED");
}
export function remoteTestSummary(state) {
  assertRemoteTestState(state);
  return { runId: state.runId, projectId: testProject.projectId, phase: state.phase, checks: state.checks,
    creationAttempted: state.attempts.create, verificationMailAttempted: state.attempts.verification, resetMailAttempted: state.attempts.reset,
    deleted: ["complete", "cleaned"].includes(state.phase), realAccountsImported: 0, cloudflareChanges: 0,
    limitations: "Isolated real Firebase TEST account only. Does not establish production/Workers/D1/UI/session integration, billing guarantees, disabled-account handling or password-hash import." };
}

export function remoteTestService(input, state, persist, dependencies = {}) {
  const config = approvedTestConfig(input);
  assertRemoteTestState(state);
  check(typeof persist === "function", "PERSIST_REQUIRED");
  const request = dependencies.request ?? fetch;
  const verify = dependencies.verify ?? providerCheckedVerifier({ projectId: config.projectId, apiKey: config.apiKey, request });
  const signed = dependencies.signed ?? signedTokenVerifier(config.projectId);
  const otherProject = dependencies.otherProject ?? signedTokenVerifier("koru-wrong-project");
  const marker = "KoruSyntheticAuth-" + state.runId;
  const note = (name) => { if (!state.checks.includes(name)) state.checks.push(name); };
  async function save() { assertRemoteTestState(state); await persist(state); }
  async function api(operation, body) {
    check(["signUp", "signInWithPassword", "lookup", "sendOobCode", "delete", "refresh"].includes(operation), "OPERATION_REJECTED");
    if (["signUp", "signInWithPassword"].includes(operation) || operation === "sendOobCode" && body.requestType === "PASSWORD_RESET") check(body.email === testRecipient, "RECIPIENT_REJECTED");
    const refresh = operation === "refresh";
    const endpoint = new URL(refresh ? "https://securetoken.googleapis.com/v1/token" : "https://identitytoolkit.googleapis.com/v1/accounts:" + operation);
    endpoint.searchParams.set("key", config.apiKey);
    let response;
    try {
      response = await request(endpoint.href, {
        method: "POST", redirect: "error", credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": refresh ? "application/x-www-form-urlencoded" : "application/json", "Cache-Control": "no-store", "X-Firebase-Locale": "tr" },
        body: refresh ? new URLSearchParams({ grant_type: "refresh_token", refresh_token: body.refreshToken }).toString() : JSON.stringify(body),
      });
    } catch { fail("NETWORK_AMBIGUOUS"); }
    let data;
    try { data = await readProviderJson(response, { allowError: true }); } catch { fail("RESPONSE_AMBIGUOUS"); }
    if (!response.ok) {
      const provider = typeof data?.error?.message === "string" ? /^([A-Z_]+)(?:\s|:|$)/.exec(data.error.message)?.[1] : undefined;
      const error = Error("FIREBASE_REMOTE_TEST_PROVIDER_DENIED");
      error.providerCode = safeCodes.has(provider) ? provider : "PROVIDER_ERROR";
      error.status = response.status;
      throw error;
    }
    check(data && typeof data === "object" && !Array.isArray(data) && !data.error, "RESPONSE_AMBIGUOUS");
    return data;
  }
  async function negative(action, codes) {
    try { await action(); } catch (error) {
      if (error.message === "FIREBASE_REMOTE_TEST_PROVIDER_DENIED" && error.status === 400 && codes.includes(error.providerCode)) return;
      throw error;
    }
    fail("EXPECTED_DENIAL");
  }
  async function rejectedIdentity(verifier, token, expected) {
    try { await verifier(token); } catch (error) {
      if (expected(error)) return;
      fail("IDENTITY_CHECK_UNAVAILABLE");
    }
    fail("EXPECTED_IDENTITY_DENIAL");
  }
  function acceptSession(data, fresh = false) {
    check(typeof data.localId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(data.localId)
      && data.email?.toLowerCase() === testRecipient
      && typeof data.idToken === "string" && data.idToken.length > 20 && data.idToken.length < 16385
      && typeof data.refreshToken === "string" && data.refreshToken.length > 10 && data.refreshToken.length < 8193
      && (fresh || state.credentials.uid === data.localId), "IDENTITY_MISMATCH");
    Object.assign(state.credentials, { uid: data.localId, idToken: data.idToken, refreshToken: data.refreshToken });
  }
  const login = (password) => api("signInWithPassword", { email: testRecipient, password, returnSecureToken: true });
  async function owner(token = state.credentials.idToken) {
    check(state.credentials.uid && typeof token === "string", "OWNERSHIP_REQUIRED");
    const data = await api("lookup", { idToken: token });
    check(Array.isArray(data.users) && data.users.length === 1, "OWNERSHIP_MISMATCH");
    const user = data.users[0];
    check(user?.localId === state.credentials.uid && user.email?.toLowerCase() === testRecipient && user.displayName === marker, "OWNERSHIP_MISMATCH");
    return user;
  }
  async function send(kind) {
    const key = kind === "VERIFY_EMAIL" ? "verification" : "reset";
    check(!state.attempts[key], "MAIL_ALREADY_ATTEMPTED");
    await owner();
    state.attempts[key] = true; await save();
    const data = await api("sendOobCode", kind === "VERIFY_EMAIL"
      ? { requestType: kind, idToken: state.credentials.idToken }
      : { requestType: kind, email: testRecipient });
    check(data.email?.toLowerCase() === testRecipient, "MAIL_RECIPIENT_MISMATCH");
    note(key + "-mail-provider-accepted");
  }
  async function cleanup(complete = false, finalPassword) {
    if (["complete", "cleaned"].includes(state.phase)) return;
    check(state.credentials.uid, "OWNERSHIP_REQUIRED");
    if (!state.attempts.delete) {
      try { await owner(); } catch (error) {
        if (error.message !== "FIREBASE_REMOTE_TEST_PROVIDER_DENIED" || !["TOKEN_EXPIRED", "INVALID_ID_TOKEN"].includes(error.providerCode)) throw error;
        const data = await api("refresh", { refreshToken: state.credentials.refreshToken });
        check(data.user_id === state.credentials.uid && [testProject.projectId, testProject.projectNumber].includes(data.project_id), "REFRESH_IDENTITY_MISMATCH");
        acceptSession({ localId: data.user_id, email: testRecipient, idToken: data.id_token, refreshToken: data.refresh_token });
        await save(); await owner();
      }
    }
    else {
      try { await owner(); } catch (error) {
        check(error.message === "FIREBASE_REMOTE_TEST_PROVIDER_DENIED" && error.status === 400 && ["USER_NOT_FOUND", "INVALID_ID_TOKEN"].includes(error.providerCode), "DELETE_REVIEW_REQUIRED");
        await negative(() => api("refresh", { refreshToken: state.credentials.refreshToken }), deniedToken);
        state.phase = "cleaned"; delete state.credentials; note("deleted-token-and-refresh-rejected"); await save(); return;
      }
    }
    state.phase = "cleaning"; state.attempts.delete = true; await save();
    await api("delete", { idToken: state.credentials.idToken });
    await negative(() => api("lookup", { idToken: state.credentials.idToken }), ["USER_NOT_FOUND", "INVALID_ID_TOKEN"]);
    await negative(() => api("refresh", { refreshToken: state.credentials.refreshToken }), deniedToken);
    if (finalPassword) await negative(() => login(finalPassword), deniedLogin);
    note("owned-test-account-deleted"); note("deleted-token-and-refresh-rejected");
    state.phase = complete ? "complete" : "cleaned"; delete state.credentials; await save();
  }

  return {
    async start() {
      check(state.phase === "prepared" && !state.attempts.create, "CREATE_ALREADY_ATTEMPTED");
      state.attempts.create = true; await save();
      const data = await api("signUp", { email: testRecipient, password: state.credentials.password, displayName: marker, returnSecureToken: true });
      acceptSession(data, true); state.phase = "created"; await save();
      check((await owner()).emailVerified !== true, "UNEXPECTED_VERIFIED_ACCOUNT");
      await negative(() => login("Wrong-Password-8!" + randomBytes(20).toString("hex")), deniedLogin);
      note("wrong-password-rejected");
      await rejectedIdentity(signed, state.credentials.idToken, (error) => error.message === "INVALID_IDENTITY");
      note("unverified-signed-token-rejected");
      await send("VERIFY_EMAIL"); state.phase = "awaiting-verification"; await save();
    },
    async verified() {
      check(state.phase === "awaiting-verification" && !state.attempts.reset, "VERIFICATION_PHASE_REQUIRED");
      acceptSession(await login(state.credentials.password)); await save();
      check((await owner()).emailVerified === true, "EMAIL_NOT_VERIFIED_YET");
      check((await verify(state.credentials.idToken)).uid === state.credentials.uid, "SIGNED_IDENTITY_MISMATCH");
      note("verified-signed-token-and-provider-status");
      await rejectedIdentity(otherProject, state.credentials.idToken, (error) => error.code === "ERR_JWT_CLAIM_VALIDATION_FAILED");
      note("other-project-token-rejected");
      state.credentials.preResetIdToken = state.credentials.idToken;
      state.credentials.preResetRefreshToken = state.credentials.refreshToken;
      state.phase = "verified"; await save();
      await send("PASSWORD_RESET"); state.phase = "awaiting-reset"; await save();
    },
    async finish(password) {
      check(state.phase === "awaiting-reset" && typeof password === "string" && password.length >= 12 && password.length <= 128
        && password !== state.credentials.password, "NEW_TEST_PASSWORD_REQUIRED");
      const oldPassword = state.credentials.password;
      acceptSession(await login(password)); await save();
      check((await owner()).emailVerified === true && (await verify(state.credentials.idToken)).uid === state.credentials.uid, "SIGNED_IDENTITY_MISMATCH");
      await negative(() => login(oldPassword), deniedLogin); note("old-password-rejected-after-reset");
      await negative(() => api("refresh", { refreshToken: state.credentials.preResetRefreshToken }), deniedToken);
      note("old-refresh-rejected-after-reset");
      const oldIdentity = await signed(state.credentials.preResetIdToken);
      try {
        const user = await owner(state.credentials.preResetIdToken);
        check(typeof user.validSince === "string" && /^\d+$/.test(user.validSince)
          && Number.isSafeInteger(Number(user.validSince)) && Number(user.validSince) > oldIdentity.authTime, "OLD_TOKEN_NOT_REVOKED");
      } catch (error) {
        if (error.message !== "FIREBASE_REMOTE_TEST_PROVIDER_DENIED" || error.status !== 400 || !deniedToken.includes(error.providerCode)) throw error;
      }
      await rejectedIdentity(verify, state.credentials.preResetIdToken, (error) => error.message === "AUTH_IDENTITY_UNAVAILABLE");
      note("old-signed-token-rejected-after-reset");
      await cleanup(true, password);
    },
    cleanup,
  };
}
