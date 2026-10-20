# Isolated Firebase Authentication Test

October 20, 2026. Mustafa explicitly confirmed Spark in the console and approved
ONE temporary account in `koru-auth-test`, one verification and one password
reset message to his own `koru.destek+firebase-test@gmail.com`, then deletion.
This does NOT authorize real-account import, production/staging data access,
new providers/paid plans, Cloudflare deployment or release-gate bypass.

## Scope and Guardrails

- Only the pinned project, app ID and recipient in test-project-policy and
  remote-test-policy are accepted. A fresh public preflight checks that the
  key and registered app match the project before every remote action.
- Official Auth REST and public signing keys only. No Firebase CLI login,
  Admin SDK, service-account JSON, privileged Google OAuth or billing API.
  Existing unrelated tooling audit findings are not suppressed or executed.
- The random initial test password is generated locally, never printed.
  State is private JSON under `.sites-runtime/firebase-auth-test/`, 0600 files,
  0700 directory, Git-ignored. While pending it contains ephemeral test ID/
  refresh tokens and the generated password: do not inspect/log/share it.
- Signup is create-only. EMAIL_EXISTS stops; an existing account cannot be
  adopted/reset/deleted. A per-run nonce in the display name, exact UID and
  exact email must match before each mail/delete operation. No arbitrary
  recipient, UID, project or password option exists on the command line.
- Exclusive file lock and atomic private checkpoints. Creation/mail attempts
  are saved BEFORE sending; ambiguous sends are never automatically retried.
  Unknown creation outcomes require operator review, not another signup or a
  password reset of an existing account. Never remove state to force a rerun.
- Redirects/cookies/cache disabled, bounded JSON and timeouts. Negative tests
  accept only expected provider denials; outages, quota or CAPTCHA problems
  cannot masquerade as a rejected password/deleted account.
- Cleanup uses the account's own token, matching UID/email/nonce. Expired
  tokens may refresh only into that same identity. An ambiguous delete can be
  confirmed on retry, without touching other accounts. Credentials are removed
  from the current local state after confirmed cleanup. Earlier private state
  checkpoints can persist on the local filesystem; no provider/local physical
  erasure guarantee is implied.

## Commands

Node 24. These real commands are OPERATOR-ONLY, never CI.

```bash
corepack pnpm auth:test:remote start --confirm=spark-isolated-account-test
corepack pnpm auth:test:remote verified --confirm=spark-isolated-account-test
corepack pnpm auth:test:remote finish --confirm=spark-isolated-account-test
corepack pnpm auth:test:remote status --confirm=spark-isolated-account-test
corepack pnpm auth:test:remote cleanup --confirm=spark-isolated-account-test
```

1. `start`: create one new account, confirm ownership, test wrong-password and
   unverified signed-token rejection, send the ONE verification message.
2. Operator opens the delivered default Firebase hosted verification link in
   their own browser. Never send its code/link to chat or put it in reports.
3. `verified`: prove verified email with a fresh real signed token and uncached
   provider status; reject the same token for another project; save pre-reset
   test credentials, send the ONE password-reset message.
4. Operator opens that reset link and sets a unique TEST-ONLY password, at least
   12 characters. Do not reuse a real password or share it with support/chat.
5. Operator runs `finish` in THEIR interactive terminal and enters the new test
   password at the hidden prompt. No CLI argument, history, log or new password
   file is used. Check new login, reject old password/refresh/signed ID token;
   then delete, reject deleted tokens/refresh and new login, redact local state.

`cleanup` aborts the experiment and deletes only the proved owned account.
If the operator already reset the password, the old refresh token is revoked;
run `finish` with the new TEST password to obtain a fresh owned credential.
If a credential cannot prove ownership, cleanup stops for operator review;
it never falls back to an admin key or another account. A failed test is not
converted into a pass just because cleanup later succeeds.

## Completed Result

Actual run `c60ba062-301d-4373-aee3-4dabbb9c1d78` created ONE test account.
Wrong-password rejection and real signed-but-unverified token rejection passed.
Operator confirmed verification mail receipt and completed the hosted link.
The `verified` stage then confirmed email verification using a fresh REAL signed
token and uncached provider status. The same token was rejected for another
project. Operator redeemed the ONE reset message and ran `finish` in their own
terminal with the new test-only password. Final phase: `complete`; deleted true.
The real provider accepted the new password and rejected the old password,
old refresh token and old signed ID token. Ownership-checked deletion completed;
deleted-account token, refresh and password-login requests were rejected.
Current local state has NO credentials property. Reset password never entered
chat, command-line arguments or a new password file.
No real users imported or D1/Cloudflare changes occurred. This proves the scoped
single-account TEST experiment, not general production readiness or physical
provider erasure. Historical reports retain their original pending phases.
Private evidence (initial, verified and final stages respectively):
`.sites-runtime/firebase-auth-test/remote-report-4a2430b5-089f-4396-9ad6-2ae3f31b1560.json`,
`.sites-runtime/firebase-auth-test/remote-report-1933649c-cfcc-4b3c-825a-443504781a9d.json`,
`.sites-runtime/firebase-auth-test/remote-report-1e8c4f7d-dd35-4e21-8847-7db04be1c6a3.json`.
Final report time: `2026-10-20T06:10:48.308Z` (09:10 Europe/Istanbul).
Operator confirmation and later read-only local status/redaction checks agreed.

The operator was asked to redeem the TEST reset link, choose a unique test-only
password, run `finish` in their own terminal and enter that password privately
at the hidden prompt; this step is now complete. Never request it or the action
link/code in chat. Do NOT send another reset, recreate the account or rerun the
completed real experiment without new approval.

The isolated local unit suite is 52/52 (14 new remote-tool safety tests).
Tests include lifecycle ordering, no duplicate sends, unrelated/existing account
protection, persistence failure, UID/marker mismatch, ambiguous send/delete,
quota-vs-denial distinction and hidden-password CLI guard. Targeted lint passed.
This is not Workers, D1/Koru cookies, root UI, disabled-provider account or
password-hash-import acceptance. Main web/native dependencies remain unchanged.

[Official Auth REST](https://firebase.google.com/docs/reference/rest/auth),
[creation](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/signUp),
[out-of-band email](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/sendOobCode),
[account deletion](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/delete).
