# Koru Local Firebase Integration

October 20, 2026. Mustafa explicitly approved LOCAL isolated integration with
the actual Koru register/login/password screens, preserving existing web and
all four schemes. No production/staging rollout, real-account transfer, new
remote account/mail, paid plan or logo change is authorized.

## Architecture Decision

Use Firebase Authentication's official REST protocol behind the existing Koru
forms and API routes. This keeps username login, four themes and existing
same-origin/CSRF/rate-limit contracts, without a browser Firebase/Analytics SDK
or client-side token persistence. Passwords already reach the Koru server today;
this LOCAL branch forwards them ONLY to the isolated Auth Emulator. It never
writes managed passwords to D1. This refines the earlier client-SDK proposal;
it does NOT approve a production REST/session design or provider rollout.

- `AUTH_PROVIDER=firebase-local` is opt-in, fail-closed for unknown values.
  It additionally requires self-service local mode, group mode, a matching
  explicit HTTP 127.0.0.1 origin, a fixed demo project, loopback emulator and
  an isolated local DB marker. Request origin is checked before route handling.
- An unset provider flag preserves the current web path. The branch does not
  import real Firebase config, keys, credentials or remote endpoints. Its
  unsigned emulator-token handling is explicitly LOCAL-only, separate from the
  signed verifier used in the completed real-provider experiment. It cannot
  authenticate remote production requests.
- Provider UID is linked to a canonical D1 member ID under unique constraints.
  New verified accounts start without group memberships. Email/name/custom
  claims never bind an existing account. Legacy claim/import remains a separate
  reviewed migration, not an automatic fallback.
- Registration reserves metadata without storing a password; provider creation,
  UID checkpoint and verification precede atomic canonical provisioning.
  Verified-login retries can finish a checkpointed provisioning interruption.
  Ambiguous creation without a UID checkpoint fails closed, not email linking.
- Existing 64-hex one-use mail links and all screen geometry remain unchanged.
  Emulator OOB codes are bridged ONLY to the existing private local mailbox,
  behind hashed one-use tokens and encrypted provider action codes. No real
  email, Gmail, Resend or remote Auth request is made.
- Koru cookies carry only opaque random session handles. D1 stores the handle
  hash and AES-GCM-sealed provider credentials, with account/UID/version/purpose
  authenticated as associated data. Browser JS/storage never receives them.
- Each authorization checks canonical version/erasure/link and the provider's
  current verified/disabled/deleted/revoked state. Token refresh is also bound
  to that exact UID/project. Outage denies access; no signature-only fallback.
  The pinned emulator's refresh response `project_id` is its synthetic project
  NUMBER `12345`, not the textual demo ID. The refreshed token must separately
  retain the exact demo `aud`/`iss`, original UID and authentication time.
- Reset and password change revoke old Koru sessions. Password reauthentication
  used by deletion requests does not create an extra session. Logout revokes
  the current opaque handle server-side. No data purge is implied.
- A durable `mutation_pending` lock precedes a provider password mutation.
  All login/session/link paths reject a locked identity. The lock is released
  only in the same D1 transaction that advances the canonical session version
  and revokes old handles, after the provider confirms success. Provider/D1
  uncertainty keeps the identity frozen; a raced login cannot bypass it.
- An expired pending registration can resend verification only after proving
  the password of its checkpointed provider UID. Older bridge links are
  invalidated. Ambiguous creations without that checkpoint remain closed.

Local schema is deliberately NOT a general Drizzle production migration.
It is loaded only into a fresh, named synthetic fixture. Main/runtime dependency
graph stays unchanged. The existing emulator CLI is run credential-free and
loopback-only; its separate audit findings are not suppressed or deployed.

## Acceptance Scope

Required: real local Auth Emulator + real Koru Worker/D1 routes; actual screens
and private local mail; multiple groups/roles/appearance; no-membership account;
reset and replay/old-session denial; password change, logout, erasure freeze;
provider deletion/outage; encrypted-state and account-link boundaries. Reject
remote origin, real project, non-synthetic email and unsafe configuration.
Re-run affected shared auth/group/legacy regressions and build/type checks.
Verify screenshots for four schemes/light/dark at mobile and desktop sizes.

This work cannot establish production CPU/JWKS, real-provider app integration,
physical PWA acceptance, operational erasure, general legal acceptance or actual
legacy identity migration. Record completed evidence separately from this plan.

## Running Locally

Use Node 24. The root dependencies, Chromium and the separate prototype's
locked development dependencies must already be installed. On a fresh clone:

```bash
nvm use 24
corepack pnpm install --frozen-lockfile
corepack pnpm --dir prototypes/firebase-auth install --frozen-lockfile
corepack pnpm exec playwright install chromium
```

Start an isolated interactive Koru environment:

```bash
corepack pnpm auth:local:dev
```

Open the exact `http://127.0.0.1:<port>` URL printed by the command. Do not
replace it with localhost or a public hostname. Register a synthetic account,
for example `reader@example.test`, with a unique test-only password. Existing
production/staging users and `demo.multi` are deliberately not imported or
accepted by the Firebase-local provider.

The command also prints a fixture-specific `self-service:mail` command. Run it
in another Node 24 terminal to read the PRIVATE local verification/reset
links. No message reaches Gmail or any other real inbox. Do not paste these
links, cookies or credentials into chat, reports or Git.

Every invocation creates fresh demo-project Auth Emulator state and separate
synthetic D1s on free loopback ports. Ctrl+C stops only its owned processes.
Existing servers, local developer databases and remote resources are not reset.
Private logs/state stay in ignored `.sites-runtime/release-tests/firebase-local-*`.
Only a browser binary path is inherited from the operator's home; cloud auth,
mail secrets and Cloudflare credentials are stripped from child environments.

Run the automated real Worker/D1/Emulator/browser suite:

```bash
corepack pnpm auth:local:test
corepack pnpm test:release:unit
```

The first command stops all its servers after testing and writes a sanitized
`outputs/release-tests/firebase-local-*/firebase-local/report.json`, plus
48 login/register/security screenshots: four schemes x two modes x two
viewport widths (390/1440) x three screens. Actual browser login and password
change are exercised, not just static screenshots. The root unit command
includes local configuration, encrypted state, refresh races, redirects,
provider status and cross-service failure/freeze tests. Browser navigation is
restricted to the local Koru origin; local Admin SDK controls only this demo
emulator's synthetic users, never a remote project.

## Remaining Boundaries

- This is NOT an environment flag that can be enabled on production. Remote
  origin, real email/project and build/deploy profile activation are rejected.
- The local OOB-to-mail bridge reads the emulator's private outbox. This is
  NOT a production Firebase mail/action-link implementation. A real-provider
  Koru integration, signed token/Workers acceptance, mail routing, latency,
  CPU/quotas and billing controls still require separate verification.
- The unsigned local-token path never substitutes for the separate signed
  real-provider verifier. Provider revocation has its documented timestamp
  granularity; Koru-originated password changes also invalidate D1 versions.
  The pinned emulator does NOT revoke refresh grants: a refresh can return 200
  after revocation, but the refreshed ID is rejected by current-status checks.
  This behavior is asserted and is NOT counted as real refresh-token revocation
  proof. The completed separate real-provider experiment verified that boundary.
- A failed/ambiguous password mutation intentionally retains its lock. There
  is NO production unlock/reconciliation tool or automatic rollback to an old
  password. Use a NEW synthetic fixture for further local experiments. Remote
  rollout requires a reviewed and tested recovery procedure; manually clearing
  real account locks is not authorized by this prototype.
- Data deletion request/cancel and erasure freeze are covered. Permanent
  Firebase-account deletion plus multi-D1 purge/reconciliation is NOT integrated
  by these local tables and must not be claimed as completed data erasure.
- The separate Firebase CLI/Admin development dependency audit still has its
  recorded findings. No Firebase SDK/CLI/Admin or Analytics was added to root
  runtime/browser dependencies. Do not run the emulator tooling with real
  service-account/Google credentials or deploy it.
- The completed one-account remote experiment cannot be replayed under this
  local approval. No new remote accounts/mail, live/staging changes, migration,
  domain connection, paid plan, commit/push or logo update is included.

## Verification Record

The final local integration run on October 20 passed 16 scenarios and produced
48 screenshots, including provider disable/delete/revocation, actual forms,
encrypted-session substitution, durable password-mutation and erasure freezes,
the emulator refresh protocol and an actual owned-emulator outage.
[Final local report](../outputs/release-tests/firebase-local-25c6c7aa-48c6-47b1-a10a-aaf79049bf9f/firebase-local/report.json).
The final root unit run passed 202/202, including seven focused local identity
tests. Type checking and whitespace checks passed; no new root dependencies
or visual/brand changes were introduced by this integration.

The provider-OFF full web regression passed all 21 steps at
`outputs/release-tests/web-mvgboqfy-5871d9/suite-report.json`: 201 unit tests,
91 backend checks, production preview, API/UI/branding/legacy/membership,
22 self-service flows, 41 PWA checks, 27+8 experience checks and four update
checks. This precedes the final LOCAL-only freeze tightening and documentation;
it is not clean-commit CI or production/physical-device release acceptance.
Root lint has no errors and retains 16 pre-existing warnings; build retains
its large-chunk warning. Never convert these results into a general release
approval or claim that all warnings have disappeared.
