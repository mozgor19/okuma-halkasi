# Koru Project Session Memory

Last decision update: 2026-10-20. Read this at the start of future sessions.
This is durable repository memory, not a claim that account-wide AI memory
or every external assistant has been updated. AGENTS.md enforces the read order.
Never store credentials, private email links, tokens or real user records here.

## Current Priority

LATEST DECISION (October 20, overrides earlier local-only Firebase hold and
DNS-only launch intent below): Mustafa requested completing preparation and
going live at birkoru.com, explicitly preserving EXISTING production data and
NOT moving staging accounts/groups. He approved the separate FREE Spark TEST
project setup. Operator reports project ID `koru-auth-test`, project number
`1038145971577`; operator confirmed Email/Password Enabled AND Spark plan.
Public test-project/app preflight passed. He separately approved ONE temporary
test account, one verification and one reset mail to his owned plus-address,
and cleanup. This scoped real TEST experiment is now COMPLETE (reset/revocation
passed, test account deleted, local credentials redacted). Real account
transfer still requires presenting the migration plan, as stated in the
accepted question. No paid plan, main push, final logo integration or bypass
of failed release/security checks is approved. Existing content stays in D1;
no real users go into the Firebase test project. See PRODUCTION_MIGRATION.md
and the updated FIREBASE_AUTH_PLAN.md before acting on historical holds.

1. Launch the mobile-first web app and installable PWA first.
2. Establish professional identity, private-safe link previews and security gates.
3. Return to native Android/iOS only after web acceptance. Native work is deferred,
   not deleted; do not treat browser checks as native proof.

User: Mustafa Özgör. Product: Koru. Support: koru.destek@gmail.com.
Selected future public origin: `https://birkoru.com`. Mustafa reports buying
`birkoru.com` from Turkticaret.net on October 19. Product name remains Koru.
Current application origin is STILL `https://okuma-halkasi.mustafayapayzeka.workers.dev`.
Domain ownership does not mean DNS activation, application cutover or launch acceptance.
No purchase, paid service, production migration, deployment or auto-deploying push
without the corresponding explicit approval.
Completed approval covers Cloudflare Free DNS setup and transition preparation,
plus logo exploration. After DNS activation Mustafa requested the HTTPS/Worker
steps. Preflight is read-only; Mustafa explicitly chose CLOSE APPLICATION RELEASE
BLOCKERS FIRST, not a temporary public-info domain mapping. Domain binding remains
on hold. Do not treat the request as staging promotion, general
signup, runtime-origin, SQL, secret, paid-service or main-push approval.
Ask before each further stage and never infer final logo integration approval.
Initial DNS preparation stopped with provider HTTP 403 after successful login.
Operator then added the zone in Domains/Websites. Read-only API confirmed one
`birkoru.com` zone in the correct account, Free Website (price 0), initially pending.
Assigned NS: `cortney.ns.cloudflare.com`, `damien.ns.cloudflare.com`.
Authenticated DNS-record listing also returned 403; no broader credentials were
requested. Public authoritative DNS queries compared all EIGHT known records
(A, four CNAMEs, MX, TXT and autodiscover SRV) at ns1.turkticaret.net and BOTH
assigned Cloudflare nameservers: all matched. This is not a complete zone export.
Operator replaced registrar NS. Subsequent October 19 read-only checks confirmed
the expected pair in the .com registry AND public recursive DNS; Cloudflare API
now reports ACTIVE, Free Website, price 0, correct account. DNS activation is
complete for this scope. No Worker/custom-domain binding, HTTPS certificate,
application rollout or general release acceptance is implied or newly approved.
The latest Google screenshot still says Testing; production OAuth is unconfirmed.

HTTPS/Worker preflight: active Free zone confirmed; no existing custom-domain
mapping for birkoru.com/www. The existing public-info Worker has only ASSETS and
KORU_PUBLIC_INFO_ONLY=true; its HTTPS home returned 200 with the correct marker
and no cookie. birkoru.com HTTPS connection was refused at check time. Certificate
metadata returned provider 403; certificate provisioning is NOT confirmed. No
Worker, DNS record, certificate subscription, SQL or secret was changed.

Logo review: the operator objected to the K/book-spine replacement without approval.
Preview-only A/B/C concepts were shown, then C (simple page/leaf) was selected for
DEVELOPMENT ONLY. No new logo is approved for integration. Keep public/brand,
BrandMark, app/PWA/share assets and BRAND_IDENTITY.md unchanged until final approval.
See DOMAIN_TRANSITION.md for scope and pending operator actions.
Selected C was redrawn as a deterministic SVG proposal with the existing fonts;
`node scripts/preview-logo-proposal.mjs` creates isolated outputs only. Local
320/390/1440 bounds/font and six 24px light/dark pixel checks passed; this is NOT
application/four-theme release acceptance. Preview HTML and report are under
`outputs/brand-proposals/koru-c-v1/`. No final integration approval received.
See LOGO_PROPOSAL_C.md for the concept prompt, review scope and reproducible preview.

## Required Reading

- `BRAND_IDENTITY.md`: binding cross-platform identity and four-theme contracts.
- `WEB_RELEASE.md`: launch blockers, browser/device acceptance and release gate.
- `DOMAIN_OPTIONS.md`: dated price/registration research, not an availability promise.
- `DOMAIN_TRANSITION.md`: purchased birkoru.com, DNS inventory, limited approval and staged cutover plan.
- `STAGING.md`, `WEB_ONBOARDING.md`, `USER_DATA.md`: infrastructure and account flows.
- `WEB_EXPERIENCE_ACCEPTANCE.md`: eight-item PWA/user-experience plan and reused evidence.
- `WEB_LAUNCH_STATUS.md`: October 19 web-only launch report, blockers and commit/push vs deployment distinction.
- `WEB_PUBLIC_LAUNCH.md`: approved free origin, current hardening, production inventory and Gmail operator steps.
- `PUBLIC_INFO_SITE.md`: separately approved static-only information deployment and Google branding/ownership workflow. This is not general app launch.
- `FIREBASE_AUTH_PLAN.md`: local prototype and newly approved separate Spark TEST project setup, costs/data boundary and reviewed real-account transition requirement.
- `FIREBASE_REMOTE_TEST.md`: approved single synthetic real-project account/mail/cleanup protocol and actual pending phase.
- `PRODUCTION_MIGRATION.md`: existing-live-only data scope, offline migration proof and exact legacy account-claim boundary.
- `ACCOUNT_ERASURE.md`: operator-only local purge service, tested scope and remaining maintenance/restore/provider blockers.
- `BACKUP_RESTORE.md`: approved current single-D1 encrypted backup/remote restore proof and remaining recovery limits.
- For resumed native work: `MOBILE_HANDOFF.md` and `MOBILE_ACCEPTANCE.md` first.

## Architecture and Guardrails

- React/vinext on Cloudflare Workers, D1 canonical accounts and group-specific D1s.
- Same backend/account records across platforms; no separate mobile accounts.
- Preserve editorial, catalogue, notebook and minimal, independently in light/dark.
- Hugeicons via `components/icons.tsx`; corporate Koru mark is not a second icon family.
- Product name/installed identity/public card: Koru. Private group labels change
  with membership, role and appearance. Public metadata must never disclose a group.
- Koru identity is enabled by `APPLICATION_BRAND=Koru` AND reading groups enabled.
  Existing feature-off production keeps its historical identity and domain data.
- Current production: `okuma-halkasi.mustafayapayzeka.workers.dev`.
- Isolated staging: `koru-staging.mustafayapayzeka.workers.dev`.
- Never deploy `dist/server/wrangler.json` directly: it has production DB bindings.
- Staging deployment must use the guarded scripts, never reset an occupied group pool.
- Staging has both synthetic fixtures and operator-owned manual-test accounts;
  NEVER regard all remote data as disposable. Both creation slots are occupied.
- Keep Node 24; default Node 20 cannot run the pinned pnpm 11.
- Do not kill the user's existing development server to free a port.

## Confirmed Before Web-First Work

Operator manually confirmed staging registration email/verification, own group
creation, invitation joining from a second owned account, role/data/appearance
isolation across two groups, selection after fresh login, and reset-email/new
password login. Old-password rejection, old-session revocation and reset-link
reuse still need explicit real-account acceptance; don't infer them from login.
The security form and short-page footer fixes have regression tests.

## Open Launch Risks

- Domain is operator-owned; custom-domain activation and application cutover are
  not complete. DNS-only approval never overrides the application release gate.
- Operator reconfirmed Gmail OAuth is Testing with a seven-day guard. Do not extend
  the guard date to manufacture production readiness.
- Preserve the existing 100k password default. `PASSWORD_HASH_ITERATIONS=600000`
  is an OPT-IN candidate, with CAS upgrades. October 19 authorized isolated
  remote probe VERIFIED 100k works but 200k and 600k hit the runtime cap.
  Probe was removed and absence/protected Workers unchanged verified.
  Node crypto ALSO calls checkPbkdfLimits; local workerd success
  is NOT a bypass of the remote cap. Public Koru signup refuses the legacy cost.
  A supported stronger password architecture/runtime decision remains a blocker.
- Group provisioning uses finite preallocated databases, not unlimited signup.
- Current single-production-D1 backup/isolated restore drill was later approved
  and passed. Live SQL/rollback, multi-D1 recovery and deletion replay remain
  unapproved/unverified; see BACKUP_RESTORE.md.
- General-use privacy/terms, deletion/export/retention and biometric consent unresolved.
- Nonce/strict-dynamic CSP is implemented for Koru production with browser
  injection/hydration tests. Legacy feature-off policy is preserved. Remote
  HTTPS Turnstile acceptance and independent security review remain pending.
- Dependency audit is date-sensitive; run it again for each fixed release revision.
- Real Android Chrome and iPhone Safari installed-PWA acceptance and real social
  app previews remain pending until physically verified.

## Web-First Foundation Added

- `public/brand/` holds the Koru K/book-spine mark, app/badge icons and public
  1200x630 share bitmap. Generate from source with `pnpm brand:assets`.
- Bricolage Grotesque and Literata are self-hosted in `public/fonts/` with OFL
  licenses and Turkish Latin Extended subsets; retain Minimal's system fonts.
- Koru uses a stable public manifest and separate `/koru-sw.js`; only the generic
  offline page is cached. Legacy `/sw.js` remains notification-only.
- `web:release:check` requires revision-bound suite/audit AND manual proof;
  it deliberately fails for missing evidence. It does not deploy.
- Root Next/React/RSC and sharp/source-map-js received security patch updates;
  no native framework or native runtime version was changed. Re-run the audit
  for each candidate; workspace mobile findings are tracked separately.

## October 19 Experience Work

- Do not repeat unaffected checks: reuse the October 18 local suite and HTTPS
  staging evidence recorded in `WEB_EXPERIENCE_ACCEPTANCE.md`. New code still
  requires focused regression, then a fixed-revision release gate before shipping.
- Offline policy: memory-only viewing of already loaded records; no private cache,
  no offline writes/queue, no automatic replay on reconnect. Preserve open form
  text, skip background refresh while editing. Network status is only a hint.
- PWA updates never force reload/skipWaiting. Check on visible resume/reconnect;
  wait for ALL controlled windows to close. Two-version browser test is separate
  from physical Android/iPhone installed-PWA acceptance, which remains pending.
- New first-steps tour is versioned per canonical account, not per group/browser;
  eligible verified accounts see it once, can defer and replay from account menu.
- Canonical migration `0011_account_experience.sql` adds tour preferences and
  password-verified deletion REQUESTS, not a data purge. Local only so far.
  Missing tables disable new tools without breaking existing account/group flows.
- Data-rights endpoint must not depend on Gmail/OAuth availability. Do not mark a
  deletion request completed without actual, audited erasure/retention handling.
  A later local operator-only cross-D1 service/owner-transfer prototype now exists
  with migration 0012; it is NOT a completed operational erasure system. Enforced
  writer stop, sole-owner closure, operator queue, retention and restore replay
  remain launch blockers. No remote account/group data was deleted in this work.
- The room asset is re-encoded from its unchanged PNG to WebP (2,126,335 to
  170,602 bytes), same geometry. This is not a new measured launch-time guarantee.
- Production-bundle local mobile lab (3 samples, 1.6Mbps/150ms/CPU x4):
  authenticated ready median 4.710s cold / 1.422s warm; cold LCP 3.964s.
  First-load performance is NOT accepted. Profile critical JS/hydration/state
  chain next. Measurements and 38 new focused checks are linked in the plan.
- VisualViewport handling hides mobile bottom navigation only while an editing
  focus loses substantial height, not while pinch zooming. Physical keyboards
  and iPhone/Android installed-app behavior still require device evidence.

## Memory Maintenance

Record decisions and verified scope, not optimistic completion claims. Keep
ephemeral reports in ignored `outputs/`, private operator evidence in ignored
`.sites-runtime/`; link the current report when closing a task. Never mark a
manual check passed without the operator/device evidence for that exact revision.

## General Public Web Preparation

- `app/page.tsx` is now a force-dynamic SERVER wrapper. Live client screens
  moved to `components/reading-app.tsx` without a design change. Koru initial
  private state reuses the exact authorized `/api/state` handler, not internal
  HTTP or alternate filters; no-store remains mandatory. Legacy keeps its
  client state path. Initial media URLs are group-scoped too.
- Profile/dialog chunks are deferred. Ctrl/Cmd+K remains; stored participant
  preview uses an SSR-safe external store, including blocked-storage fallback.
- Public policy requires `FACE_RECOGNITION_ENABLED=false` pending biometric
  approval. Upload/read/matching APIs and UI obey it; normal albums/manual
  attendance and clearing own references remain. Koru is off even when the flag
  is missing; historical non-Koru web retains behavior unless explicitly disabled.
- Separate production Gmail authorization support exists but is NOT issued or
  installed. Never re-label the current staging token or edit its expiry.
  Current matching Google project ID is `koru-mail`. Operator screenshot
  confirmed Testing; Publish app is disabled because Branding is incomplete.
  Homepage/privacy/terms fields are blank. The legacy production privacy/terms
  redirect to login; do not claim those URLs are public policy pages.
  Direct page: https://console.cloud.google.com/auth/audience?project=koru-mail.
- `web:preflight` is read-only. October 19 production inventory found one DB
  and missing new account/group/experience tables/config. No production SQL,
  secrets, deployment or paid actions ran.
- Release runner now requires `password-runtime` and `web-production`, testing
  the actual local production bundle, CSP, SSR isolation and four light/dark
  schemes at desktop/mobile widths.
- Local erasure execution/ownership transfer was subsequently prototyped; see
  ACCOUNT_ERASURE.md. General-use legal text, operational erasure, production
  backup/restore/migrations/capacity and physical device/social acceptance are
  NOT completed. Local success does not authorize publication.
- Development full runs were deliberately interrupted for the remote cap and
  legacy/bootstrap reset-protection fixes. They are NOT passing release reports.
  Candidate `public-release-20261019-candidate` FAILED at PWA: the welcome
  tour covered the account menu. Focused PWA/experience checks then passed
  after real UI deferral, unrelated-account baseline comparison and removing
  unnecessary dev nonces. Do not count the failed suite as passing.
  Fixed-source full rerun namespace: `public-release-20261019-verified`;
  read its real status, never assume success.

## Public Information Only Approval

- Mustafa explicitly approved a LIMITED Cloudflare deployment for public
  introduction/privacy/terms, not app rollout, migrations, signup, secrets,
  main push or paid services. Use isolated `koru-public-info` with only static
  assets; preserve existing production/staging Workers and all data.
- `public-info/` reuses Koru identity, self-hosted fonts and synthetic-only
  product screenshots. Its HTML explicitly states closed-test limitations;
  it is not legal/general-launch acceptance. Public origin is separate from
  the approved application origin. See `PUBLIC_INFO_SITE.md` for commands,
  evidence, constrained target checks and Search Console HTML-tag steps.
- Public information deployment succeeded on October 19, deployment ID
  `357fc8e0-d13a-4a77-b9b1-fc553b246fd0`. Its three public URLs returned 200;
  app deployment/settings unchanged, no SQL/secrets/paid actions. Five unit
  and 22 local browser checks passed. Live browser proof is separate in
  `outputs/koru-public-info/https-report.json`; read its actual status.
  Google ownership/branding/scope verification and production OAuth are STILL
  pending. Next operator step is the real public URLs/authorized domain in
  Branding, then Search Console URL-prefix HTML-tag ownership if required.
- Prior full app suite passed 21 steps with source digest
  `9e26a20443a88b6478789d9ade3328a09da01a2d95c310874b81d8658f8627bc`.
  Public-site additions are later changes; do not reuse that digest as current
  full app release evidence. Public-only verification has a separate artifact
  digest and never overrides the main web release gate.

## October 19 Launch Blocker Prototypes

- Authorized synthetic remote Worker `koru-password-probe` measured 100k PBKDF2
  supported, 200k rejected and 600k rejected in all three ready-gated attempts.
  No DB/secret/routes. Cleanup confirmed absent; production/staging/info Worker
  deployment/settings fingerprints unchanged. Report is private under
  `.sites-runtime/koru-password-probe/report.json`. No CPU or load claim.
- Mustafa approved ONLY a LOCAL Firebase Auth Spark proposal/prototype and
  account migration plan. No real Firebase project, service account, account
  export/import, paid plan, remote config or app integration is approved.
  No Firestore/content migration. New Google identity processing is documented.
- Latest explicit choice: "Simdilik yerel prototipte kalalim". Do NOT proceed
  with a real Spark test project or remote synthetic tests. Keep existing local
  artifacts; real Firebase setup requires a new explicit request/approval. This
  holds only the external Firebase stage, not all web work. Password/provider
  release blockers remain open; do not weaken the policy to publish anyway.
- `prototypes/firebase-auth` has separate workspace/lockfile, official Web/Admin
  SDKs + Auth emulator; synthetic demo project, loopback ephemeral ports, isolated
  credential-free environment. Root web/native dependencies/lock are unchanged.
  Commands: `auth:prototype:unit`, `auth:prototype:test`, `auth:prototype:audit`.
- 20 local signed-JWT/UID-link/import contract tests and 11 real local emulator
  checks passed. This is NOT actual Workers verification or production D1/UI
  integration. Real mail, password-hash import, provider revocation/disabled
  status bridge and Koru-cookie invalidation remain unimplemented/unverified.
- Firebase import PBKDF2_SHA256 cap is 120k; 100k format is prepared but actual
  Google import not tested. 600k/e-mail-less/unverified accounts require reviewed
  recovery, never hash downgrade or email-only linking. See FIREBASE_AUTH_PLAN.
- Tooling audit is separately BLOCKED (high findings in emulator CLI and unused
  Firestore dependency path); this is not added to production dependencies. Web
  production audit has no high/critical web-path findings but retains lower
  findings; mobile findings remain deferred, not erased.
- `db/account-erasure.ts` is a LOCAL operator-only library, no public route or
  remote CLI. Canonical-only migration 0012 records durable plan/checkpoints.
  Reviewed transfer, own-media purge, FK tombstone, rollback/retry, corrupt-journal
  and retained-ledger auth/recovery guards tested, including genuine local D1.
  Thirteen erasure tests included in 178 passing root unit tests; 91 backend
  isolation/legacy/redirect checks, TypeScript, targeted lint and web build passed.
  Build retains the existing large-chunk warning. This is NOT a fixed
  revision full release suite. No new visual/browser/native acceptance claimed.
- Stopped-writer flags are operator attestations, NOT enforced maintenance;
  global retained erasure ledger/restore replay, sole-owner closure, review of
  third-party free text/media, operator tooling and provider deletion coordination
  are still required. No remote SQL or personal data purge ran.

## Approved Production Backup Drill

- Mustafa approved ONLY current production D1 private local backup and restoration
  into a NEW unbound D1, within Free capacity bounds; cleanup included. This is
  NOT live SQL/migration/deployment, Firebase, domain, signup or paid-plan approval.
- `web:backup:drill` requires an exact confirmation flag; no arbitrary source,
  existing target or production restore option. No remote real-data work in CI.
- AES-256-GCM snapshot, separate 0600 local key, 0700 folders, no raw user data,
  SQL/provider content/signed URLs in logs or tracked files. Backup ID is
  `7903973b-2169-42cf-9401-414b53a17ec0`; source was 2,433,024 bytes.
- Passing REMOTE report: private backups run
  `64c2e38a-5cc6-4de2-aa1d-8b2a116dba9a/report.json`. Thirteen tables and all
  17 media records' bytes/types matched; schema/sequences/FK/quick_check passed.
  Restore plus verification 5.474s is NOT application RTO. Temporary D1 removed,
  absence verified; original six DB identities and all inventoried Worker
  settings/deployments unchanged. Zero source mutation SQL or app deployment.
- Native file import hit D1_RESET_DO twice; both targets cleaned up, those reports
  remain failed. Official query batch succeeded with remote FK enforcement intact.
  Eight synthetic backup regressions are included in 186 passing root unit tests;
  targeted lint passed. Anonymous HTTPS smoke: production/staging redirect to
  their login (307), public info returns 200. This is not account-flow acceptance.
- Subscription metadata was 403: don't call billing verified. Count/storage fit
  Free bounds; no paid-service action. Daily remaining quotas aren't independently
  verified. Source data remains protected; only the new target accepts mutations.
- This is one current D1 proof, not full release acceptance. Fresh pre-migration
  backup/SQL approval, off-device retention/key recovery, RPO/RTO, multi-D1 recovery
  and deletion-ledger replay remain open. Key and backup share the same computer.

## October 20 Existing-Data Rehearsal

- New offline `web:migration:rehearse --backup-id=...` has no network/auth/live
  apply option. Exact old schema/FK/integrity checks precede one transaction
  for canonical 0008-0012 and default group/mapping seeds. Unknown, partial or
  already-migrated schemas are refused; verification failures roll back all.
- Historical encrypted backup `7903973b-2169-42cf-9401-414b53a17ec0` rehearsal
  PASSED: 13 old tables/75 rows and 17 media unchanged; 16 new tables; six
  accounts/roles/IDs/hashes/session versions and default memberships preserved.
  The legacy group name is preserved from LEGACY_GROUP_NAME, not 0008's
  placeholder. Guests excluded; no staging rows or guessed email profiles.
- Private report: migration-rehearsals/01fff960-3ac7-453f-bbb5-7f4a19ab892a.json
  under .sites-runtime/koru-production. Zero remote requests/live writes.
  Nine synthetic tests passed; focused lint passed. Not remote migration or
  fixed-revision release proof. An initial sandbox invocation could not run
  the Git subprocess; the complete offline rerun succeeded with permission.
- All six legacy accounts match the known 100k hash FORMAT, not a tested
  password/import. ZERO verified email profiles means ZERO automatic Firebase
  imports. A reviewed old-account + verified-provider-UID claim/recovery flow
  is required before real identity migration, without altering content IDs.
- Fresh backup, enforced writer stop, remote atomic SQL guard, production
  Firebase integration and release acceptance remain pending. No live change
  or domain mapping has occurred during this rehearsal.
- Full root local unit regression: 195/195 passed, including genuine local D1
  erasure tests and nine new migration tests. Targeted script/prototype lint
  and git diff whitespace check passed. No full UI or physical proof rerun.
- Firebase signed-token/provider-status candidate has 29/29 LOCAL tests (nine
  new mocked-provider tests). Fixed official accounts:lookup, no redirects,
  cookies/cache, bounded response, auth_time vs validSince, fail-closed outage/
  disabled/deleted/unverified/revoked/UID mismatch. NOT real provider behavior,
  Workers acceptance or Koru-cookie revocation. No Firebase CLI credential use.
- Latest screenshot shows correct koru-auth-test Authentication/providers,
  Email/Password ON, Email link OFF, Save disabled. Operator asked to close
  with Cancel and verify Enabled in the list; Spark plan is not visible or
  confirmed. No web-app config/real-provider test yet.

## October 20 Firebase Test Setup Follow-Up

- Operator subsequently confirmed Email/Password Enabled and registered the
  web app `1:1038145971577:web:262fb6d97d63a64601fba8` in koru-auth-test.
  Screenshot supplied public web config. Only four Auth/web fields retained
  privately at .sites-runtime/firebase-auth-test/web-config.json (0600/0700);
  no key is copied to tracked source/docs/logs. SDK Analytics example was NOT
  executed/imported; screenshot presence is not Analytics runtime acceptance.
- `auth:test:preflight` performs one official public GET /v1/projects with
  firebaseAppId provider binding check; no OAuth/CLI/Admin credentials.
  PASSED remote check: correct pinned project/app and auth domain, public
  domains localhost + koru-auth-test.firebaseapp.com / koru-auth-test.web.app.
  Report: .sites-runtime/firebase-auth-test/preflight-8e34d8a4-ee6b-4b86-9b2d-e8dc1046c334.json.
  Zero accounts/imports/mail/Cloudflare changes. Billing/Spark/method settings,
  key restrictions, real identity/revocation/mail remain unverified by that API.
- Shared bounded-JSON reader is used by both status and public preflight;
  nine new synthetic preflight tests bring isolated unit checks to 38/38.
  Main web/native runtime dependencies, features, logo and live data untouched.
- Async questions pending: confirm Spark in panel; approve one temporary
  synthetic account in TEST only, one verification + reset mail to operator's
  plus-address and cleanup. Do NOT create/send before those answers. No real
  user transfer, test-to-production promotion, private key or paid plan action.

## October 20 Approved Real Firebase Experiment

- The pending questions were answered: Spark confirmed; ONE temporary account
  in koru-auth-test, one verification + one reset message to operator-owned
  koru.destek+firebase-test@gmail.com, then cleanup explicitly approved.
- New guarded auth:test:remote is operator-only, never CI. No Firebase CLI/
  Admin SDK/service key/Cloudflare action. Pinned project/app/recipient, public
  preflight, nonce/UID/email ownership before mail/delete, create-only signup,
  private checkpoints and exclusive lock; ambiguous creation/mail never retries.
  Private JSON holds ephemeral test credentials until cleanup; never dump it.
- Isolated suite 52/52 passed (14 new tool safety tests), targeted lint and
  whitespace check passed. No new main web/native runtime dependency.
- REAL run c60ba062-301d-4373-aee3-4dabbb9c1d78: single account created;
  wrong password denied, real signed/unverified token denied, one verification
  email PROVIDER-ACCEPTED. Actual phase awaiting-verification. Inbox receipt
  and click pending. Reset not sent; account NOT deleted yet. No real users
  imported, staging/live D1 or Workers changed. See FIREBASE_REMOTE_TEST.md.
- Async operator question: open delivered TEST verification link only at
  https://koru-auth-test.firebaseapp.com/ and report outcome, never code/link.
  Then run `verified` with exact confirmation to check signed verified identity
  and provider status and send ONE reset. After operator reset, `finish` runs
  in THEIR terminal with a hidden TEST-password prompt, checks revocation and
  deletes; never ask for the password in chat. Owned cleanup also supported.
  Existing source password/mail/session release blockers are not closed yet.

## October 20 Verified Email and Reset Send

- Operator confirmed TEST verification mail arrived and completed the hosted
  verification link. Exact `verified` action on the same run succeeded.
- REAL fresh signed-token + uncached provider-status check accepted the
  verified account; same token rejected for another project. Provider accepted
  ONE reset mail. Current phase is awaiting-reset, account NOT deleted yet.
  Private evidence: .sites-runtime/firebase-auth-test/
  remote-report-1933649c-cfcc-4b3c-825a-443504781a9d.json.
- Async question now asks operator to redeem the reset on the expected TEST
  Firebase hostname, choose a unique 12+ character TEST-only password and run
  `nvm use 24` followed by `corepack pnpm auth:test:remote finish
  --confirm=spark-isolated-account-test` in THEIR terminal. Password goes only
  into its hidden prompt, never chat/arguments. Report only complete/safe error.
- Reset receipt/redemption, old password/refresh/ID-token denial and cleanup
  remain PENDING until actual finish evidence. No resend, new account, real
  account migration, root web/Workers/D1 rollout or general acceptance implied.

## October 20 Completed Firebase Experiment

- Operator reported finish `phase: complete`. Verified the actual final report
  remote-report-1e8c4f7d-dd35-4e21-8847-7db04be1c6a3.json in ignored
  .sites-runtime/firebase-auth-test, same run c60ba062-301d-4373-aee3-4dabbb9c1d78.
  Final report time 2026-10-20T06:10:48.308Z; local status also complete/deleted.
- Real reset new-password login succeeded; old password, old refresh and old
  signed ID token rejected. Owned temporary account deleted; deleted token/
  refresh/login rejected by finish. Current local state has NO credentials
  field. Do not dump/recover earlier secret-bearing filesystem checkpoints.
- Eleven named report checks complete. This is not Workers runtime, actual
  Koru routes/cookies/D1/UID linking, disabled-account behavior, import, general
  release or a provider physical-erasure guarantee. No new root/live changes.
- Do NOT recreate this account, resend mail or rerun the completed experiment
  under the used one-account approval. No new real user transfer approved.
  Next work is a separately scoped Koru application integration, preserving
  legacy web and existing data; production provider/cutover still needs review.
- Async approval requested for LOCAL isolated Koru register/login/password
  integration only, preserving web/four themes. Answer pending; no deployment,
  real-account transfer, new remote account/mail or paid service in that scope.

## October 20 Local Koru Integration Approval

- Mustafa answered YES to local isolated Koru register/login/password
  integration, preserving web/four schemes. No production/staging deployment,
  real-account transfer, new remote account/mail or paid service is included.
- Architecture decision BEFORE implementation: FIREBASE_LOCAL_INTEGRATION.md.
  Existing forms/server REST, loopback-only demo Auth Emulator, canonical UID
  link, opaque Koru cookies and encrypted D1 provider credentials. Existing
  64-hex local-mail actions remain, without browser SDK/token storage. Remote
  activation and legacy identity claim/import are explicitly NOT implemented
  or approved by this local step. Verification evidence is still pending.

## October 20 Completed Local Koru Integration

- Implemented the approved LOCAL-only integration in the actual Koru forms,
  auth/onboarding routes and D1 identity layer. Decision/run guide:
  FIREBASE_LOCAL_INTEGRATION.md. No browser Firebase/Analytics SDK or root
  runtime dependency was added; four schemes and existing geometry unchanged.
- Local-only provider flag, exact HTTP 127.0.0.1 request/emulator origins,
  fixed demo project, DB marker and synthetic .test/.invalid emails fail closed.
  Existing provider-unset web behavior remains. Managed accounts cannot fall
  back through legacy login, bootstrap, password change or password recovery.
- Canonical unique UID links (never email adoption); passwordless D1 metadata;
  pending-signup resume with checkpointed UID/password; one-use hashed local
  mail tokens with encrypted emulator OOB codes. No real mail/config imported.
- Opaque HttpOnly Koru handles, SHA256 handle storage and HKDF/AES-GCM sealed
  provider credentials with identity/version/purpose AAD. Current provider
  status, canonical version/link/erasure and ciphertext are checked on use.
  Logout revokes handles; reset/change revoke all prior canonical sessions.
- Password mutation acquires a durable link freeze BEFORE the provider call.
  Only confirmed provider success plus atomic D1 version/session revocation
  releases it. Provider uncertainty or failed D1 commit keeps all login and
  session paths blocked. Production reconciliation/unlock is NOT implemented;
  never manually clear real account flags using this synthetic test as approval.
- Important pinned-emulator differences: refresh project_id is synthetic
  project NUMBER "12345", while token aud/iss must match demo-koru-auth-local.
  Refresh grants themselves are NOT revoked by the emulator; refreshed IDs are
  still denied by authoritative status checks. Tests assert this limitation,
  not a false real-provider refresh-revocation pass. Real one-account test
  previously proved real revocation; do not repeat its used approval.
- Final local integration: 16/16 scenarios, 48 login/register/security PNGs,
  4 schemes x light/dark x 390/1440. Actual browser login/password change,
  multiple groups/roles/appearance, no-group denial, local reset/replay,
  provider revocation/disable/delete, encrypted-state substitution, mutation/
  erasure freezes and owned-emulator outage passed. Final report:
  outputs/release-tests/firebase-local-25c6c7aa-48c6-47b1-a10a-aaf79049bf9f/firebase-local/report.json
- Final root unit tests: 202/202 (seven local identity tests); tsc and diff
  checks passed. Lint has zero errors and 16 existing warnings. Prior complete
  provider-OFF web regression passed all 21 steps under a fixed dirty source
  snapshot before LOCAL-only freeze/refresh tightening and docs updates:
  outputs/release-tests/web-mvgboqfy-5871d9/suite-report.json
  Includes 91 backend, production preview, 20 API, 211 UI/layout, 35 branding,
  legacy/membership, 22 self-service, 41 PWA, 27+8 experience and 4 updates.
  First baseline attempt used occupied port 5184 and stopped; existing server
  was NOT killed. Successful rerun used separate 5294/5295 ports.
- These are NOT clean-commit CI, signed remote-provider Koru/Workers, Free CPU/
  quota, physical PWA, permanent Firebase+multi-D1 erasure or migration proof.
  Separate emulator tooling audit findings remain; run it credential-free only.
  Native work, live/staging, real accounts/passwords/data, domain/DNS, logo,
  paid plans, main, commit and push were NOT changed in this local step.
- Interactive preview deliberately left running on http://127.0.0.1:46603
  using a NEW synthetic fixture, not the completed/destructive test fixture:
  firebase-local-b4c03e51-2a24-4082-b786-c30305fa10ef. It is temporary local
  development, not a public deployment; curl /register returned 200. Use
  .test addresses and own unique TEST passwords. Private mailbox command:
  OKUMA_TEST_RUN_ID=firebase-local-b4c03e51-2a24-4082-b786-c30305fa10ef corepack pnpm self-service:mail
  Do not paste its link/password/cookies into chat or Git. Restarting
  auth:local:dev creates a new fixture and prints a new URL/mail command.
- Next remote Koru test-provider integration, production mail/action handlers,
  reconciliation/erasure and legacy account claim/import remain separately
  scoped and unapproved by this LOCAL step. General release blockers remain
  in WEB_LAUNCH_STATUS.md / WEB_PUBLIC_LAUNCH.md / PRODUCTION_MIGRATION.md.

## October 20 Approved C Logo and Launch Request

- Mustafa accepted the local integration and explicitly requested integrating
  the selected C page-and-leaf logo, then going live. Old draft-only logo and
  DNS-only restrictions are historical, not a reason to ask for logo approval
  again. No paid plan, unsafe gate bypass or main push authorization follows.
- Operator supplied a separate production Firebase project ID `koru-951bf`.
  Do not reuse `koru-auth-test`, import synthetic/staging users or infer identity
  from email/name. Current remote-provider Koru integration is still absent.
- New canonical `KORU_MARK_PATHS` in lib/brand-identity.ts; currentColor five
  filled paths from approved C vector, same fonts/palettes. BrandMark's legacy
  BookOpen fallback and old web notebook/favicon assets remain untouched.
- Versioned v2 mark/icon, Apple, maskable, notification and social assets;
  unversioned Koru icon aliases also updated for installed old manifests.
  Manifest ID/start_url stay `/`; no account/group data in public metadata.
  Self-contained offline logo and shell-cache v3; no private caching/forced reload.
  Public-info header uses same paths. Brand identity contract is now v1.2.
- Current-turn production read-only preflight passed; original Worker still
  has one canonical D1 and lacks 0008-0012 account/group configuration/tables.
  No production SQL, Secret, domain binding, deployment or data copy performed.
- Logo-specific geometry/raster/mask-safe/PWA update and four-scheme browser
  checks are being run. Results must be recorded after actual completion,
  not inferred from old local/provider tests or preview-only logo screenshots.

## October 20 Logo Acceptance and Production Config Check

- Operator supplied koru-951bf web config and explicitly requested placing it.
  Stored only four public config fields in ignored 0600 file
  .sites-runtime/koru-production/firebase-web-config.json. Never print its key,
  execute the pasted module or add gstatic/Analytics/Storage to the client.
  Dedicated web:auth:preflight is a fixed, read-only, resource-pinned GET with
  bounded JSON/error redaction. Seven synthetic policy tests passed. It does
  NOT wire real authentication, create users/mail/imports or mutate Cloudflare.
- First production project check found missing birkoru.com. Operator confirmed
  Spark and Enabled after the domain instructions; a SECOND real check verified
  the domain is actually present. Passed report timestamp 07:26:08.524Z,
  firebase-preflight-85c4fc85-c7f7-4552-9c7c-cf9555b1f3ed.json under the private
  production directory. Public API cannot attest Spark, methods or key policy.
  See FIREBASE_PRODUCTION.md for exact current scope and still-open code work.
- Focused C-logo/PWA acceptance PASSED 58 checks, 16/20/24/32px pixel/negative
  space, opaque Apple/maskable and complete mark within 80% safe circle.
  4 schemes x light/dark x 390/1440 Home/Plan/Meeting and all 8 Profile tabs;
  plus public 320/390/430/1440 variants, metadata, offline/recovery/install wiring.
  outputs/release-tests/brand-c-20261020/web-pwa/report.json; 210 PNGs.
  This run has physicalAndroid/physicalIos/realSocialPreviews explicitly pending.
- First expanded run failed ONLY at synthetic install-event timing after a
  new full navigation; final run waits for actual React hydration and PASSED.
  PWA report now records running/failed as well as passed, preventing stale
  success reuse. Cache update lifecycle 4/4 passed with source-version detection.
- New actual synthetic notebook home screenshots replace public-info examples
  for desktop/mobile light/dark; not edited old screenshots or real user data.
  Public-info local acceptance 22/22 passed. Icons, share card, mobile dark
  home and desktop light profile inspected visually. No remote info deployment.
- Root unit baseline 203/203 and new seven production-policy cases passed;
  final aggregate rerun PASSED 210/210. tsc, UI role/contrast contract, production
  build and diff checks passed. Lint zero errors, 16 preexisting warnings;
  production bundle still reports >500k chunk warning, not hidden.
- Current web dependency audit passed its no-high/critical-web rule, but has
  low @babel/core and moderate fast-uri web findings. Mobile has separate
  high findings and remains deferred; do NOT say the entire repository is
  vulnerability-free. Audit dirty-source report outputs/web-security/dependency-audit.json.
- Existing production/staging accounts, schema, passwords and data untouched.
  No application/domain deploy, paid services, real account writes or main push.
  General release still blocked by real-provider Koru code/legacy claim,
  production schema/mail/erasure/capacity and actual phone/release acceptance.
- Built production artifact was also exercised on local workerd at 5298:
  9/9 checks passed, including nonce/inline-handler CSP denial, no state
  waterfall, group isolation, stored participant view, lazy profile/search
  and disabled biometric enforcement in all four schemes/modes/viewports.
  outputs/release-tests/brand-c-20261020/web-production/report.json.
  This is NOT Firebase production-provider Koru or remote Free-runtime proof.
- web:release:check correctly BLOCKED: dirty source, no matching clean full
  suite/evidence bundle, real phone/social/operational proof missing. No flags
  changed or evidence fabricated to pass it. Focused success is not a release.
  Initial sandbox gate invocation failed to spawn git; rerun with permission
  produced the actual policy failures, not an infrastructure-success claim.

## October 20 Production Auth Implementation In Progress

- Mustafa again explicitly requested finishing and going live, accepting later
  ordinary bug fixes. This does not authorize weakening identity/data safety,
  inventing release evidence, paid plans, staging import or a main push.
- Read current memory/brand/release policy. No subagents: user did NOT request
  delegation. No live/staging/remote identity writes or schema/Secret changes.
- Implemented a SEPARATE opt-in `AUTH_PROVIDER=firebase` source branch, not
  promotion of unsigned local emulator auth. Fixed koru-951bf/production origin
  (plus exact isolated canary origin only when staging=true); rejects local
  emulator/bypass variables. Added exact jose 6.2.12 root runtime dependency
  and lockfile. Existing firebase-local and provider-unset regression preserved.
- lib/firebase-protocol.ts: JOSE RS256/project/issuer/audience/kid/time/provider/
  verified email, then uncached authoritative provider lookup on every use.
  Fixed official API/JWKS URLs, bounded/redacted HTTP, Turkish locale; no SDK,
  Analytics, Storage, service-account credential or browser token storage.
- db/firebase-accounts.ts + lib/firebase-auth.ts: new registration UID checkpoint,
  no email adoption, verified-password provisioning, opaque encrypted fb2 sessions,
  UID/project-bound refresh, server logout, reset/change with durable freeze.
  Ambiguous password change can reconcile ONLY with fresh password proof AND
  an advanced provider validSince; reset/erasure freezes do not auto-unlock.
- Legacy coexistence verifies existing hash WITHOUT creating/rehashing passwords.
  Explicit claim proves current legacy password + chosen new strong password,
  then verified checkpoint UID + version-CAS link; keeps account ID/role/groups/
  appearance, increments session version and rejects old sessions. Managed hashes
  cannot fall back to bootstrap/password paths when provider is disabled.
- Added canonical candidate drizzle/0013_firebase_auth.sql. NOT applied remotely,
  NOT in the full production migration/rehearsal plan or Drizzle model inventory
  yet. Additional group DBs must never get identity tables.
- Current forms/API/proxy integrated, remote link form adds new password/consent,
  /auth/email handles opaque bounded codes, strips URL, never consumes on GET,
  no supplied continueUrl/apiKey redirect. React strict-effect replay preserved.
- Local checks: 8 SQLite account tests passed (provider DOUBLE only, not remote
  proof), 8 actual signed RSA/protocol/policy unit cases; previous aggregate
  217 passed before final account tests. Final aggregate PASSED 226/226.
  tsc and production build passed; lint caught fixture variable `module`, renamed
  compiledModule, targeted rerun passed. Chunk warning/preexisting lint warnings
  remain. Full fixed-source suite/browser/remote-provider/canary NOT done yet.
- Critical remaining work BEFORE deployment: remote Koru canary/Free budget/
  provider mail/action acceptance; enumeration/timing review for direct remote
  registration/recovery calls; pending/orphan operational reconciliation;
  Firebase+multi-D1 erasure (existing erasure service does NOT handle new FK
  tables yet); final schema/migration/backup/pools/Turnstile/rollback/monitoring,
  final policy/privacy source and matching full release/manual evidence.
- Operator async question asked Firebase password policy min12+letter+number and
  Turkish Koru mail fields. They then sent verification/reset template screenshots
  asking EXACTLY what to enter. Answered immediately in commentary: both Sender
  name Koru, Reply to koru.destek@gmail.com, From noreply unchanged; verification
  Subject 'Koru: E-posta adresini doğrula', reset 'Koru: Şifreni yenile'; Message
  and %LINK% placeholders unchanged. No SMTP/Customize domain changes.
- IMPORTANT correction to earlier async advice: keep existing Firebase Action
  URL NOW; birkoru.com/auth/email is NOT deployed. Switch only after actual
  HTTPS endpoint works. Do NOT leave new mail pointing at a dead app endpoint.
  Operator completion/template/password-policy confirmation is still pending.

## October 20 Firebase Template Editing Unavailable

- Operator reported exact Firebase message: Email template updates are currently
  unavailable for this project; it directs to Firebase Support. This is NOT
  confirmation of saved sender/subject/reply-to, custom Action URL, password
  policy, mail delivery or general launch readiness.
- Researched official Firebase docs/support/status. No authoritative specific
  cause established. Auth email support troubleshooter could not be read by the
  public browsing tool. Do not invent Spark/paywall, project-age, global outage,
  quota, ban or automatic resolution-time explanations. Do not upgrade billing,
  recreate projects, bypass restriction via API or send new test mail silently.
- Keep default templates/Firebase action handler and no dead birkoru.com URL.
  Official docs describe the default hosted handler, NOT this project's actual
  delivery. Current production project still needs its own delivered verification/
  reset + signed Koru-session/revocation acceptance. Earlier test-project email
  evidence does not establish that. Support request should contain project ID,
  exact error and reproduction only, never keys/passwords/OAuth/action links.
- Source changes this turn are documentation/memory only. No remote writes,
  accounts/mail, credentials, database migration, deployment or paid service.

## October 20 Mail Fields, Refused Remote Test, Local Hardening

- Latest operator report: Sender name and Reply to saved; Subject locked.
  Keep default subject; do not infer a billing restriction or broken delivery.
  Default Firebase Action URL stays until the real custom endpoint is live.
  Operator confirmed minimum 12 characters plus letter/digit password policy.
- Operator EXPLICITLY DECLINED additional isolated remote Worker/D1, the
  proposed koru-951bf temporary account and verification/reset test mails.
  Do NOT create/retry/relabel these operations. No new approval was requested.
- Local fixes: remote registration/recovery perform input/config/marker checks
  before generic response; identity lookup and provider work run via vinext
  after()/waitUntil, not account-specific HTTP timing/failures. No automatic
  retry on ambiguous signup/delivery, no private errors in background logs.
  Unit fixture explicitly queues/drains background tasks and asserts no lookup
  reservation/provider call before response, same response for existing/unknown/
  outage/orphan states. This is local proof, NOT actual remote delivery.
- Added candidate 0013 to OFFLINE canonical migration plan + Drizzle models.
  Claim CHECK rejects half-null proofs (SQLite NULL would otherwise pass).
  Exact firebase_environment marker verified and all new identity tables empty;
  corrupt seed/extra identities cause whole rehearsal rollback.
- Existing operator D1 erasure is STILL NOT Firebase erasure. Added early
  fail-closed blockers for managed hash/link/session/pending claim, including
  persisted resume plans, before freeze/purge. No fake provider deletion.
- Validation: root unit 234/234, typecheck, focused ESLint and production build
  passed. Build retains known >500kB chunk warning. Full final fixed-revision
  browser/device/release acceptance still pending.
- Reran OFFLINE encrypted-backup migration rehearsal: 13 legacy tables/75rows/
  17media/six accounts byte-preserved, 20 added tables, zero provider imports.
  .sites-runtime/koru-production/migration-rehearsals/600db719-346d-4dfd-aaf7-dabcdec1849c.json
  No network/live SQL/staging copy. Old backup is NOT current cutover evidence.
- No remote account/mail/resource, Secret, SQL, domain/app deployment, paid
  plan, main push or existing user-preview restart. Do not claim go-live.
  Actual provider/Free-runtime evidence and Firebase erasure coordination,
  production runtime/schema/pools/Turnstile/release evidence remain unfinished.

## October 20 Launch Request, Actual Worker Fix, Full Regression

- Mustafa again requested finishing checks and going live, then explicitly
  requested commit/push WITHOUT coauthor BEFORE any live deployment. Continue
  on work/koru-web-pwa-20261019; do not push main. No paid plan/staging import.
  Refused extra remote test account/Worker/D1/mail remains refused.
- Read-only Cloudflare access works. birkoru.com active/Free/right account;
  six D1s total (five occupied staging plus canonical), no Custom Domains.
  As-is Worker still old single-D1 configuration. No schema/runtime flag writes.
- Turnstile metadata API returns403. Asked operator for necessary panel setup,
  not API/global credentials. They supplied public Site Key
  0x4AAAAAAFdcSVotjRtGDJZM and reported successful TURNSTILE_SECRET_KEY upload
  to okuma-halkasi. Never read/log the Secret. Pin public key in launch policy.
- Aligned production preflight to approved birkoru.com + fixed production
  Firebase project; old origin retained only as legacyOrigin metadata. New
  passwords managed by Firebase; legacy100k VERIFY only. No Gmail/test/emulator/
  bootstrap Secret promotion. Added missing Firebase schema inventory.
- Added actual LOCAL workerd/D1 production-auth tests with esbuild, synthetic
  RSA signatures/JWKS + intercepted transport. NO real Google network/account/
  mail. Found REAL bug missed by Node mocks: workerd rejects redirect:error.
  Fixed Firebase API/JWKS to manual + explicit reject; bounded JWKS JSON,
  provider-key outages503. Three tests cover full signed/session/password flow,
  wrong project/status/outage, and API/JWKS redirects without foreign forwarding.
- First full release suite PASSED21/21 including211layout,35branding,22onboarding,
  59PWA,27+8experience,4update checks. Report
  outputs/release-tests/web-final-20261020-2/suite-report.json. It is DIRTY
  precommit evidence; do not rewrite it as clean or different revision.
  Root production dependency audit found NO web high/critical; deferred mobile
  findings remain. Secret-pattern scan469sourcefiles returned no findings.
- Commit source/docs/assets with existing author config, no coauthor trailer;
  private backups/keys/configs/user data/.sites-runtime/outputs remain ignored.
  Then run clean fixed-revision suite/audit and actual release gate. Do not
  manufacture missing device/social/security/privacy/operations evidence.
# October 20 First Public Cutover In Progress

- Latest Mustafa instruction: public first opening, no six-account restriction;
  best-effort checks. Keep missing manual evidence pending. Separate explicit
  first-launch exception does NOT weaken standard later-release gate or permit
  failed automated/audit/data/security checks. Coauthorless commit/push to work
  branch before deploy remains mandatory; main untouched. Native deferred.
- Added resumable Firebase erasure coordination + protected Secret-only operator
  API/CLI, canonical0014 provider checkpoints, incremental D1 phases, explicit
  maintenance/writer-drain/third-party-content preconditions. No real erasure or
  extra remote test account/mail/Worker/D1. Google user ADC is not yet configured;
  privileged deletion must fail closed without it. No service-account key.
- Canonical production migration now0008-0014 (21newtables), exact legacy bytes
  preserved in tests. Public privacy/terms now disclose actual Firebase/D1 flow;
  staging keeps previous disclosure. Approved C logo unchanged.
- Production script uses fixed account/Worker/canonicalID/origin, explicit
  maintenance, fresh encrypted export-only backup/offline restore/rehearsal,
  atomic additive D1 batch + exact old/new verification, two PERMANENT empty
  Free group pools, Firebase/Turnstile/erasure Secrets and root/www domains.
  No secrets/user data in Git. Old origin redirects read requests to birkoru.com;
  mutations require resubmission there. No cookie/token forwarding.
- This entry describes prepared code, NOT completed production operations.
  Read private cutover.json/remote preflight for actual status before claiming
  published. Preserve earlier private preview46603 and its data.

## October 20 Public Launch Completed

- Actual public app is https://birkoru.com. www and legacy workers.dev redirect
  to canonical HTTPS; foreign/old-origin mutations require resubmission. Code
  revision1c1b235d75e0162a1c1bd3b6387bb07ce5eececf was committed/pushed WITHOUT
  coauthor to work/koru-web-pwa-20261019 BEFORE deployment. Main untouched.
  Worker version7a93d173-3973-45e3-a05b-0691abad4c6e at100%.
- Maintenance/drain, fresh encrypted export-only backup774e0dff-cc70-42e7-958e-5afc6f8648cb,
  authenticated disk decrypt/local restore, exact offline rehearsal, atomic
  canonical0008-0014 and remote exact verification completed. Six old accounts,
  13tables/75rows, original roles/hashes/IDs/versions/media/sequences preserved.
  21tables added; no automatic Firebase imports or guessed email assignment.
- Two PERMANENT production group D1 pools created, schema-verified empty, bound
  as GROUP_CREATE_ONE/TWO. Never staging/test copies. Total account D1 count8;
  only two new-group slots initially, NOT unlimited self-service capacity.
  Staging/public-info settings unchanged. No paid plan or refused remote test
  resource/account/mail. Preserved SESSION_SECRET and Turnstile; installed
  Firebase API/erasure operator Secrets, removed obsolete MEMBER_CREDENTIALS
  only after all non-guest accounts proved persisted. Biometric processing off.
- Cloudflare100117 blocked root/www Custom Domain because old A/CNAME existed.
  DNS exact-name reads403; no scope bypass. Operator confirmed deleting only
  old root A/www CNAME. Domain deploy then succeeded; both enabled/correct Worker.
  Temporary DNS-wait maintenance config is NOT current public configuration.
  cutover.json phase opened; schema/runtime preflight now zero blockers.
- Clean suite outputs/release-tests/web-launch-1c1b235/suite-report.json passed
  21/21 (252root unit,211layout,35branding,22onboarding,59PWA,27+8experience,
  4updates). Matching dependency audit passed; web low/moderate and deferred
  mobile high findings remain. Do not claim no vulnerabilities.
- Actual HTTPS anonymous Chromium smoke14checks passed, screenshots inspected:
  live pages/CSP/no-store, approved C assets byte-identical, exact Firebase/
  Turnstile public config, unauthenticated access/foreign and empty signup denial,
  canonical redirects, public social metadata,390/1440light/dark, actual deployed
  anonymous-only SW caches/offline fallback/reconnect. No real account/password/
  provider email or erasure used. System DNS initially gave old/NXDOMAIN answers;
  Google public DNS confirmed assigned Cloudflare NS/current CF IPs. Smoke used
  those fresh DNS answers with unchanged hostname/TLS verification; separate
  system-DNS failed report retained. Some user resolvers may still propagate.
- First public launch is an OPERATOR-ACCEPTED EXCEPTION, not strict gate success.
  All13 missing manual criteria remain PENDING. Physical devices/real production
  mail/provider workflows/privileged erasure/complete multi-DB recovery/ongoing
  monitoring/independent legal and security review were NOT certified. Next
  releases require standard gate. Never reuse test-project mail evidence.
- Keep Firebase default hosted email action URL until separately accepted.
  Real erasure still needs explicit reviewed request, stopped/drained writers,
  content/succession review and operator Google user ADC (not installed here).
  No service-account key in Worker/browser. Never rerun migration/reset data.
- This follow-up documentation commit does NOT change the deployed application
  source. Read production runtime/version and private cutover state before
  future actions. Existing local preview46603 was not stopped or reset.

## October 20 Architecture Explanation And Gap Inventory

- User asked for a detailed visual explanation of the CURRENT architecture and
  remaining work, not another deployment or new product implementation.
- Added docs/ARCHITECTURE_CURRENT.md and offline-viewable docs/architecture/index.html,
  three editable SVG/PNG diagrams (system, account/group mapping, PWA lifecycle),
  public login screenshots and a printable PDF. This is a dated snapshot, not a
  live dashboard or production-readiness certificate. Application code unchanged.
- Fresh READ-ONLY production settings/schema check at17:49TRT: three correctly
  bound D1s, zero required runtime/schema blockers. Aggregate-only count at
  17:52TRT: six accounts, one registered group, both new production pools empty;
  account inventory eight D1s including five staging DBs. No names/emails/content
  read. No provider account/mail, deployment/SQL/Secret changes or paid service.
- Important distinctions documented: default-group content physically shares
  canonical DB; each new group consumes one prebound DB; no Firestore/R2; new
  passwords Firebase-managed but pass through Worker memory over HTTPS; roles
  local to group; appearance per account/group; sync is idle/focus/online +30s
  polling, not realtime push; PWA only anonymous offline shell/no write queue.
- R01-R13 backlog separates implemented-but-unverified provider/legacy/group
  workflows, operator erasure ADC/queue, scheduled off-device multi-DB recovery,
  quota/monitoring, main/CI/human-gate enforcement, legal/export/support,
  physical PWA/social/performance/accessibility/security, historical-doc cleanup
  and deferred native/new features. Do not repeat completed migrations or turn
  13 pending manual evidence categories into13 known defects.
- Official D1/Workers/Firebase quota documents checked; limits are plan docs,
  not remaining project quota measurements. No plan upgrade approved.
- Static report checked locally at390/1440px; diagram text bounds and image
  loading verified. These document-rendering checks are NOT app/device acceptance.
  No commit/push requested for this report task; do not infer publication approval.

## October 20 Shared Group Storage Change

- Latest request: remove the GLOBAL three-group provisioning bottleneck without
  breaking existing accounts/content. User has not attempted group creation;
  do not report a reproduced production failure or assume both pools are full.
- Implemented additive canonical0015 shared_group_storage plus13 scoped domain
  tables. New groups can share canonical D1 with group_id, composite tenant FKs,
  scoped read CTEs and explicit scoped insert/update/delete/conflict construction.
  Raw database() fails inside shared contexts. No SQL rewriting/parser heuristic.
- Existing default/dedicated groups keep their storage/IDs/roles/media. No DB
  transfer, reset or staging import. Old in-progress provisioning retries remain
  supported. Global group-count limit removed in new mode; the existing per-owner
  three-created-group abuse limit and20 memberships are separate, explicit limits.
- SHARED_GROUPS_ENABLED is an explicit post-migration rollout flag. To pause new
  creation retain shared readers and set GROUP_CREATION_DISABLED=true; never
  revert to a shared-unaware binary or restore over newly created groups.
- API/state/media/calendar/action and protected account erasure use tenant scope.
  Erasure checkpoints use unique per-group routing keys, not the physical DB name;
  unrelated shared groups are excluded. Existing erasure operator/Free quota and
  real provider acceptance remain operational checks, not newly certified here.
- New standard-gated web:groups:deploy keeps all production bindings, takes a
  fresh encrypted export after maintenance/drain, rehearses ONLY0015, verifies
  every previous schema/typed row/BLOB/sequence, applies atomic DDL and enables
  shared mode. It refuses first-launch exception flags and missing proof BEFORE
  authentication/writes; a failed cutover requires explicit journal review.
- Focused LOCAL SQLite/workerd tests cover8+groups, concurrent duplicate creation,
  full domain flows, invitations/roles/allappearance values, stale/foreign/revoked
  access, same media key in separate tenants, tenant erasure, additive preservation
  and creation pause. Full existing release regression is required too.
- This entry is PREPARED IMPLEMENTATION, NOT a production deployment. No new live
  SQL/Worker/Secret/provider account/mail or paid service has been performed.
  Existing strict release gate still applies; do not reuse the consumed first
  public launch decision. See SHARED_GROUP_STORAGE.md for rollout/recovery.

## October 20 Shared Update Publication Request

- Mustafa requested publishing this update, then explicitly answered the risk
  question: "Evet, yalnız bu güncelleme için belirtilen riskleri kabul ederek
  yayınla". This is NEW one-time authority for the shared-group storage update,
  not reuse of the consumed first-launch exception or general future authority.
- Added a separate revision/digest/0015-bound shared-update assessment. Missing
  manual checks stay PENDING, never passed. Failed automated/audit/manual checks,
  wrong identities, dirty/unpushed source, dependency changes or unrelated code
  cannot be waived. Standard release policy itself is unchanged.
- Mandatory path remains coauthorless commit/push to the WORK branch BEFORE
  remote writes, clean fixed-revision suite/audit, current runtime/schema checks,
  verified maintenance/drain, FRESH encrypted backup and offline0015 rehearsal,
  exact old-data preservation, additive atomic DDL, then enable shared storage.
  No main push, paid plan, staging import/reset, extra remote synthetic account/
  Worker/D1/mail. Earlier physical device/operator/provider reviews stay pending.
- Additional local signed-RS256 Firebase + shared-groups test passed against
  real workerd D1, including different local/canonical IDs, scoped reads/writes
  and old-handle rejection after password change. This is synthetic transport,
  not real production account/mail acceptance.
- This entry records authorization/preparation, NOT completed deployment. Check
  the private shared-rollouts journal and live preflight for actual outcome.

### First Shared Rollout Stopped Before Schema

- Coauthorless400c714 was pushed to the work branch, not main. Clean revision
  passed21/21 full release steps (268 root unit tests) and a fresh dependency
  audit with no high/critical web findings. Thirteen manual checks stay pending.
- Rollout e827ae97 stopped at drained BEFORE backup export or schema writes:
  the older backup guard assumed the pre-launch canonical-only Worker, while
  current production correctly has DB plus both dedicated group bindings.
  Backup attempt061d7bdc failed its preflight; no SQL, restore or schema applied.
- Explicitly checked no shared schema exists and reopened the SAME tested
  shared-disabled application with maintenance=false. Login200 confirmed.
  Failed journal retained with recovery details; no blind cutover replay.
- Fix only the backup source topology guard, with negative tests for missing/
  extra/aliased/wrong canonical bindings. It still exports ONLY canonical DB,
  creates no remote restore DB in export-only mode, and verifies all Worker
  settings/deployments remain unchanged. New clean commit/suite/audit and fresh
  revision-bound decision are required before a new rollout attempt.
