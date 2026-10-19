import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readStagingMailSecret, assertClosedStagingMailTarget } from "../staging-mail-policy.mjs";
import { gmailOAuth } from "../gmail-oauth.mjs";
import { staging } from "../staging-policy.mjs";

test("staging mail upload requires the exact closed runtime origin and flags", () => {
  const bindings = Object.entries({ AUTH_PUBLIC_ORIGIN: staging.origin, STAGING_ENVIRONMENT: "true", SELF_SERVICE_ENABLED: "false", SELF_SERVICE_LOCAL: "false" }).map(([name, text]) => ({ name, text, type: "plain_text" }));
  assert.doesNotThrow(() => assertClosedStagingMailTarget(bindings));
  for (const index of [0, 1, 2, 3]) {
    const changed = structuredClone(bindings); changed[index].text = "unexpected";
    assert.throws(() => assertClosedStagingMailTarget(changed));
  }
});

test("OAuth authorization becomes a single expiring staging secret without carrying untrusted extras", () => {
  const directory = mkdtempSync(join(tmpdir(), "koru-staging-mail-"));
  const path = join(directory, "authorization.json");
  const value = { environment: "koru-staging", intendedSender: gmailOAuth.sender, scope: gmailOAuth.scope, clientId: "123-test.apps.googleusercontent.com", clientSecret: "synthetic-secret", refreshToken: "synthetic-refresh", authorizedAt: new Date().toISOString(), extra: "no-copy" };
  try {
    writeFileSync(path, JSON.stringify(value), { mode: 0o600 });
    const result = readStagingMailSecret(path);
    assert.equal(result.origin, staging.origin); assert.equal("extra" in result, false);
    assert.equal(Date.parse(result.expiresAt), Date.parse(value.authorizedAt) + 7 * 86_400_000 - 60_000);
    chmodSync(path, 0o644); assert.throws(() => readStagingMailSecret(path)); chmodSync(path, 0o600);
    writeFileSync(path, JSON.stringify({ ...value, environment: "production" })); assert.throws(() => readStagingMailSecret(path));
    writeFileSync(path, JSON.stringify({ ...value, authorizedAt: "2000-01-01T00:00:00.000Z" })); assert.throws(() => readStagingMailSecret(path));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
