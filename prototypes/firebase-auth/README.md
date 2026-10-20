# Firebase Auth Local Prototype

Approved scope: local synthetic accounts and a migration proposal only. No real
Firebase project, billing, service account, account export, remote D1 mutation,
deployment, app route or logo change is part of this prototype.

October 20: the operator separately approved creating the free Spark TEST
project `koru-auth-test` (number `1038145971577`) in the console. This local
emulator runner is STILL demo/loopback-only and must not be retargeted or given
real credentials. Operator confirmed Email/Password Enabled and registered the
web app, confirmed Spark, then approved ONE synthetic real-project account,
one verification/reset message to the owned plus-address and cleanup. Real user
transfer is not approved by test-project setup; existing production content
stays in D1 and staging must not be copied.

```bash
nvm use 24
corepack pnpm --dir prototypes/firebase-auth install --frozen-lockfile
corepack pnpm auth:prototype:unit
corepack pnpm auth:prototype:test
corepack pnpm auth:prototype:audit
corepack pnpm auth:test:preflight
```

This package has its OWN workspace and lockfile. Firebase dependencies are NOT
added to the web/native dependency graph. Package age checks remain enabled.
Unneeded dependency install scripts are explicitly denied, not broadly allowed.

The runner uses official Firebase Web/Admin SDKs and the official Auth emulator,
binds only loopback ephemeral ports, uses `demo-koru-auth-local`, strips Google
credentials and never logs in. No external mail is sent. Emulator logs and
synthetic action links stay in ignored `.sites-runtime/firebase-prototype/`.
It does not attach to or reset an existing emulator. A port race fails startup.

`identity-contract.mjs` is a candidate signed JWT verifier plus UID-link and
import contracts. It has no emulator fallback. Unsigned token handling is
restricted to `emulator-only.mjs` and the SDK emulator test. The local mapping
fixture is SQLite, not the real production D1 identity/session integration.

`provider-status.mjs` is a separate signed-token + uncached official REST
account-status candidate. Its nine mocked-response tests join the original 20
contract checks (29 passed). It rejects deleted/disabled/revoked/mismatched or
unverified identities and provider failures without private diagnostic output.
It is NOT real-provider/Workers acceptance or a Koru session integration.

`auth:test:preflight` is a SEPARATE read-only public Firebase project/app check,
not an emulator/CLI login or account test. It accepts only the pinned TEST
project/web app and ignored private web config; no arbitrary target/flags or
ambient privileged/emulator credentials. It uses the official public GET with
firebaseAppId verification; no tokens/cookies/mail/accounts or provider writes.
Real public-config check passed; isolated unit suite is now 38/38. The report
does not establish Spark/billing/method policy, mail or signed account behavior.
See the plan for pending approval before any synthetic remote account/mail test.

The later single-account experiment is now explicitly approved and implemented
as `auth:test:remote`, separate from the emulator and public preflight. See
[FIREBASE_REMOTE_TEST.md](../../docs/FIREBASE_REMOTE_TEST.md) BEFORE running it.
It never uses CLI/Admin credentials and accepts no arbitrary account/project
or command-line password. Local safety suite: 52/52. Real verification mail
receipt/click and signed verified identity/provider status passed; wrong-project
token rejected. Operator redeemed the ONE reset mail and ran the hidden terminal
`finish` step. Real experiment COMPLETE: reset/revocation checks passed, owned
test account deleted, current local credentials removed. No replay, new account
or extra mail under the used single-account approval.

The scoped experiment establishes delivery/redemption for its one test mailbox,
not general deliverability, remote Workers CPU/JWKS behavior, actual Koru session
integration, PBKDF2 import compatibility or live quota/abuse protection.
The separate tooling audit currently blocks production adoption; do not copy
the Admin SDK/emulator CLI into a Worker or publish this directory as a site.

See [the architecture and migration plan](../../docs/FIREBASE_AUTH_PLAN.md).
