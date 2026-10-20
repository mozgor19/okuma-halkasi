import assert from "node:assert/strict";
import { before, test } from "node:test";
import { pbkdf2Sync } from "node:crypto";
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from "jose";
import { signedTokenVerifier, linkedIdentity, approvedImportRecord, DEMO_PROJECT } from "./identity-contract.mjs";
import { requireLocalEmulator } from "./emulator-only.mjs";

let privateKey, key, verifier;
before(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  key = { ...await exportJWK(pair.publicKey), kid: "synthetic-local-key", alg: "RS256", use: "sig" };
  verifier = signedTokenVerifier(DEMO_PROJECT, createLocalJWKSet({ keys: [key] }));
});
function claims(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return { sub: "synthetic-uid", aud: DEMO_PROJECT, iss: `https://securetoken.google.com/${DEMO_PROJECT}`,
    iat: now - 2, exp: now + 3600, auth_time: now - 3, email_verified: true,
    firebase: { sign_in_provider: "password" }, ...overrides };
}
async function token(payload = claims(), header = {}) {
  return new SignJWT(payload).setProtectedHeader({ alg: "RS256", kid: key.kid, ...header }).sign(privateKey);
}
test("signed token candidate verifies exact project, issuer, signature and verified password identity", async () => {
  const value = claims();
  assert.deepEqual(await verifier(await token(value)), { uid: value.sub, authTime: value.auth_time });
});
const now = Math.floor(Date.now() / 1000);
for (const [name, payload] of Object.entries({
  "wrong project": { aud: "other-project" }, "wrong issuer": { iss: "https://evil.invalid" },
  "audience list": { aud: [DEMO_PROJECT, "another-project"] },
  expired: { exp: now - 1 }, "future issue": { iat: now + 60 },
  "future login": { auth_time: now + 60 }, "negative login": { auth_time: -1 },
  "empty UID": { sub: "" }, "long UID": { sub: "x".repeat(129) },
  "unverified address": { email_verified: false },
  anonymous: { firebase: { sign_in_provider: "anonymous" } },
  tenant: { firebase: { sign_in_provider: "password", tenant: "unexpected" } },
  "missing login": { auth_time: undefined }, "missing issue": { iat: undefined },
  "missing expiry": { exp: undefined },
})) test(`signed verifier rejects ${name}`, async () => {
  await assert.rejects(verifier(await token(claims(payload))));
});
test("signed verifier never accepts unsigned emulator tokens, unknown keys or tampered tokens", async () => {
  const unsigned = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url") + "."
    + Buffer.from(JSON.stringify(claims())).toString("base64url") + ".";
  await assert.rejects(verifier(unsigned));
  await assert.rejects(verifier(await token(claims(), { kid: "unknown" })));
  const good = await token();
  const parts = good.split(".");
  parts[1] = Buffer.from(JSON.stringify(claims({ sub: "attacker" }))).toString("base64url");
  await assert.rejects(verifier(parts.join(".")));
});
test("UID link alone grants canonical account; email and custom admin claims cannot link accounts", () => {
  const row = { accountId: 9, sessionVersion: 4, validAfter: 0, disabled: false, erasureBlocked: false };
  const store = { byUid: (project, uid) => project === DEMO_PROJECT && uid === "linked" ? row : null };
  assert.deepEqual(linkedIdentity(store, DEMO_PROJECT, { uid: "linked", authTime: now }), { accountId: 9, sessionVersion: 4 });
  assert.throws(() => linkedIdentity(store, DEMO_PROJECT, { uid: "other", authTime: now, email: "same@example.invalid", admin: true }));
  assert.throws(() => linkedIdentity(store, "other-project", { uid: "linked", authTime: now }));
  for (const patch of [{ erasureBlocked: true }, { disabled: true }, { validAfter: now + 1 },
    { validAfter: undefined }, { sessionVersion: undefined }, { accountId: -1 }]) {
    assert.throws(() => linkedIdentity({ byUid: () => ({ ...row, ...patch }) }, DEMO_PROJECT, { uid: "linked", authTime: now }));
  }
  assert.throws(() => linkedIdentity(store, DEMO_PROJECT, { uid: "linked", authTime: now - 600 }, { requireRecent: true }));
});
test("import planner decodes raw hex bytes and groups by original work factor, never downgrades 600k", () => {
  const password = "Synthetic-Password-4837";
  const salt = "00112233445566778899aabbccddeeff";
  const hash = pbkdf2Sync(password, Buffer.from(salt, "hex"), 100000, 32, "sha256").toString("hex");
  const row = { accountId: 7, email: "synthetic@example.invalid", emailVerified: true, hash, salt, iterations: 100000 };
  const record = approvedImportRecord(row);
  assert.equal(record.user.uid, "koru-account-7");
  assert.equal(record.user.passwordHash.length, 32);
  assert.equal(record.user.passwordSalt.length, 16);
  assert.equal(record.user.passwordHash.toString("hex"), hash);
  assert.equal(record.options.hash.rounds, 100000);
  for (const patch of [{ iterations: 600000 }, { iterations: 0 }, { iterations: 5000 }, { salt: "text-not-hex" },
    { emailVerified: false }, { erasureBlocked: true }, { accountId: 0 }, { hash: "" }]) {
    assert.throws(() => approvedImportRecord({ ...row, ...patch }), /MANUAL_RECOVERY/);
  }
});
test("emulator entry point refuses real projects, remote hosts and credentials", () => {
  const env = { GCLOUD_PROJECT: DEMO_PROJECT, FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9199", KORU_FIREBASE_LOCAL_ONLY: "true" };
  assert.equal(requireLocalEmulator(env).projectId, DEMO_PROJECT);
  for (const patch of [{ GCLOUD_PROJECT: "koru-real" }, { FIREBASE_AUTH_EMULATOR_HOST: "evil.invalid:9199" },
    { FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:99999" }, { KORU_FIREBASE_LOCAL_ONLY: "false" },
    { GOOGLE_APPLICATION_CREDENTIALS: "secret.json" }, { FIREBASE_TOKEN: "token" }]) {
    assert.throws(() => requireLocalEmulator({ ...env, ...patch }), /LOCAL_DEMO/);
  }
});
