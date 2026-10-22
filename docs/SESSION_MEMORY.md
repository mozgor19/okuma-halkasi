# Koru Project Session Memory

Last decision update: 2026-10-22. Read this at the start of future sessions.
This is durable repository memory, not a claim that account-wide AI memory
or every external assistant has been updated. AGENTS.md enforces the read order.
Never store credentials, private email links, tokens or real user records here.

## Current Priority

LATEST EMAIL FOLLOW-UP (October22,23:17TRT): application source
7f796dab6c840eca2051bcd5e2ce0556c4d7bde1 is live at https://birkoru.com,
Worker725de55c-4ed4-4a46-ac7a-1e7ccd7d9fba at100%; maintenance OFF.
Mustafa's NEW explicit request published ONLY the reviewed email-verification
completion fix; reported own testing is not all manual acceptance. Clean
coauthor-free work-branch source was pushed BEFORE deploy; main untouched.
Fresh audit has no high/critical WEB finding (deferred native and low/moderate
findings remain).298 units/91 backend/types/targeted lint/build passed, as did
compiled Chromium6/WebKit6 new-flow checks and production10 checks/32 mobile
forms on exact7f796da. Full suite and13 manual/physical categories remain
PENDING, not passed or generally waived. Eight live anonymous HTTPS/security/
canonical redirect and JS/CSS byte-identity checks passed; no real test
account/mail or authenticated production-user acceptance was performed.

All THREE fresh AES-256-GCM backups/disk decrypt/OFFLINE restores and exact
old schema/typed rows/media/sequences passed before opening. ZERO SQL writes,
migrations or D1 cleanup/transfer; keep all8 D1s. Both dedicated bindings,
occupied production-group-1, shared readers, Secrets, Firebase/Turnstile,
domains, other Workers and meeting mail OFF preserved. Firebase mail branding
settings/default handler were NOT changed; hosted verification still needs
the new-password completion shown by the new /account form. Do NOT replay
0015/16/17/18. Evidence: outputs/web-acceptance/7f796da/{production-outcome,production-health}.json;
outputs/release-tests/mobile-stable-20261022-a/{email-verification-chromium,email-verification-webkit,web-production}/;
private email-verification-core.json. Rollout6c46c819-9724-4267-aa53-5d7094274324,
deployment876c8cdd-3700-455d-9cf7-570325033525. DO NOT rerun the consumed private
rollout. New scoped authority is consumed; documentation-only outcome commits
are NOT application deployments. Owned5334 test preview stopped; other user
previews were not reset.

EMAIL PUBLICATION REQUEST (Historical, now completed above): Mustafa explicitly asked
to publish the previously reviewed email-verification fix and reported testing
it. This is NEW scoped publication authority for that fix only, not D1 cleanup,
schema/provider/template changes or a general waiver. Preserve all THREE live
D1 bindings including the occupied production-group-1, shared readers, Secrets
and mail OFF. No SQL writes/migrations are part of rollout. Require clean,
coauthor-free pushed work-branch source, fresh audit, core/auth checks, targeted
compiled Chromium/WebKit, current production identity, fresh three-DB encrypted
backups/disk decrypt/offline restore/exact preservation before opening.
Operator's report is not proof of every manual category; remaining full/manual
criteria stay pending, not marked passed. Completion is recorded above and
this scoped authority is now consumed. Main and native remain untouched.

READ-ONLY D1 AUDIT (October22,23:04-23:06TRT): Mustafa requested inventory and
approval BEFORE any cleanup.8 remote D1s confirmed:3 bound to okuma-halkasi,
5 to koru-staging; public-info has none, Pages list empty. IMPORTANT:
koru-production-group-1 is NOT empty: canonical registry routes an existing
group there, with member/account-link/ownership rows. NEVER delete it merely
because books/meetings are empty. Production-group-2 has no group reference,
ownership or domain content except factory setting, but remains bound and
required by current deployment/backup policies: candidate ONLY after separately
approved coordinated source/binding/rollback changes, fresh backup and recheck.
All five staging DBs have registered roles; both staging-create DBs are now
allocated, one holds book/roadmap data. No orphan restore/test DB found.
New live groups already use canonical shared storage, not new D1 allocation;
staging still uses the older dedicated model. See docs/DATABASE_INVENTORY.md.
Only GET metadata and fixed SELECT catalog/aggregates ran: zero SQL writes,
DDL/migrations, deletes, exports, deployments, binding/Secret/paid changes.
No personal rows/mail or credentials were collected. Earlier local email
changes remain undeployed; audit grants NO cleanup/deployment authority.

EMAIL FOLLOW-UP (Historical local preparation, now published above): a reported verified legacy
email still showed unverified because the hosted Firebase handler updates the
provider only; Koru provision() previously ran only on a new-password login.
The custom /auth/email action now also finalizes the exact checkpointed UID
and email; old-version/expired/foreign-UID/erasure claims remain blocked.
Hosted-handler returns now target /account. Its account-scoped pending flag
shows a new-password completion form, including after reload, instead of sending
the user back to groups before linking. The same rate-limited login endpoint
has an opt-in completeVerification=true path requiring verified Firebase proof,
NEVER legacy-password fallback. It issues the existing HttpOnly fb2 session;
canonical status then removes the reminder. No email-only merge, UID change,
new schema, credential persistence in browser, palette or other workflow change.
Long completion commands wrap only inside their new scoped form.
Synthetic account/endpoint and workerd tests cover preservation and revocation;
targeted browser checks use mocked provider responses, NOT real-user acceptance.
Passed:16 account/endpoint tests, Firebase protocol tests,5 workerd scenarios,
types, targeted lint and production build. New standalone
scripts/test-email-verification.mjs passed6 checks in BOTH Chromium/WebKit,
with four-scheme light/dark320/1440 screenshots. Earlier failed test-setup and
new-button overflow reports remain; only the new form's command wrapping was
changed. Evidence: outputs/release-tests/mobile-stable-20261022-a/email-verification-{chromium,webkit}/.
Full suite/manual/live-user acceptance were NOT performed or waived.
Live remains370c0d0/3de95dfd below; no deployment/production SQL/real mail or
Firebase panel change was made in this task. The user's already-verified hosted
flow can complete on CURRENT live by logging in with their existing username
and the NEW account password chosen during linking, not the old saved password.

Firebase mail %APP_NAME% uses Project Settings > General > Public settings >
Public-facing name, not sender name/reply-to, internal Project name or web-app
nickname. It must be Koru; project ID koru-951bf MUST remain unchanged.
That provider setting was not changed or remotely verified here. See the new
operator instructions in FIREBASE_PRODUCTION.md; do not bypass template-edit
restrictions, enable another sign-in provider or upgrade billing to fix a name.

PREVIOUS LIVE FOLLOW-UP (October22,21:32TRT): application source
370c0d034c56efbf531cfdf2aaf9575de7a70e53 is live at https://birkoru.com,
Worker3de95dfd-8c5e-46da-963a-efadab32fc38 at100%; maintenance OFF.
Mustafa's NEW request covered ONLY the verification reminder/mobile install
offer and preserving other behavior. Mandatory Next16.4.1 fixed newly blocking
critical/high advisories; audit policy was NOT relaxed. Do not downgrade to
affected Next. Clean coauthor-free source was pushed to the work branch;
main unchanged. New-feature Chromium13/WebKit13 and meeting-edit WebKit18
passed on exact370c0d0. Core294 units/91 backend/types/lint/build and actual
production10 checks/32 forms on851660c were retained with verified identical
application inputs: EVERY tracked file except the test wait helper is unchanged.
The helper settles requests before WebKit navigation, never filters errors.
Failed original reports remain. Fresh passing audit matches370c0d0.
Full suite/13 manual and physical iPhone/Android installation acceptance are
PENDING, not a passing standard gate or standing waiver for future releases.

Three fresh AES-256-GCM backups/disk decrypt/OFFLINE restores and exact old
schema/typed rows/media/sequences passed. Third export stopped once; original
failed journal retained. Same-source resume verified the exact owned maintenance
deployment, revalidated both disk backups, completed the third and compared ALL
data before opening. ZERO SQL/migrations; never replay0015/16/17/18. All DB
bindings/shared readers, Secrets, Firebase/Turnstile, domains, other Workers
and mail OFF preserved. No real accounts/mail, paid or native changes.
Live six-check health passed: login200, private account/state401, production
configuration, CSS/notification/install JS byte identity and anonymous mobile
iOS guide/dismissal. This emulation is NOT physical installation acceptance.
Evidence: outputs/web-acceptance/370c0d0/{production-outcome,production-health}.json;
outputs/release-tests/mobile-stable-20261022-a/{account-install-chromium,account-install-webkit,meeting-edit-layout-webkit}/report.json;
851660c application-only continuation: web-production/report.json and private
core command records. Rollout304a2f39-585d-4721-90eb-8d20a0a89af8,
resume37c8ce8c-9df2-4200-bd11-86c7f145da19; DO NOT rerun private scripts.
New scoped authority is consumed. Later docs-only commits are not application
deployments. Existing user previews were not reset; owned5332/5333 checks stopped.

PUBLICATION PREPARATION (Historical, October22): Mustafa explicitly requested
publication of ONLY the account notification/mobile installation follow-up,
preserving everything else. Before the completed outcome above, a fresh audit
on473b07c BLOCKED on newly published Next GHSA-2464-fhr4-w9xw (critical) and
GHSA-p3m5-59mp-jv5r (high). The original blocked report is retained at
outputs/web-security/dependency-audit-blocked-473b07c.json. Audit policy was NOT
weakened. The necessary fix pins ONLY Next16.4.1 and updates its lock entries;
no general dependency refresh, native version or app behavior change.
https://github.com/advisories/GHSA-2464-fhr4-w9xw
https://github.com/advisories/GHSA-p3m5-59mp-jv5r
Physical/manual criteria remain pending; do not represent targeted
browser checks as a passing standard full/manual gate. Existing live version
was93ce9f97 during preparation; the new completed outcome is above.

LOCAL PREPARATION (Historical, now published above): Mustafa requested an unverified-email
reminder in notifications and an automatic mobile home-screen installation
offer. NotificationCenter reuses useAccountStatus and the existing /account
verification/linking screen; confirmed false status adds one badge/list item,
verified/unknown/error status does not. Focus/pageshow refresh removes it after
verification. Meeting/device notification delivery logic is unchanged; no mail
is sent automatically and no auth/backend/schema changes were made.
PwaInstallProvider isolates installation UI from the unchanged service-worker,
keyboard and offline guards in PwaLifecycle. Mobile supported browsers receive
a dismissible, nonmodal offer; its button calls the retained native install
event in the user gesture. Final approval belongs to the browser, never silently
install. iPhone/iPad use the real Safari Share/Add to Home Screen instructions;
there is no equivalent programmable iOS install prompt. Existing account-menu
install action remains available, including iOS guidance after dismissal.
Seven-day device-local dismissal, native/standalone suppression, dialog/tour/
keyboard deferral and sensitive-page exclusions prevent repeated interruptions.
No unsupported-browser install success is claimed. Four schemes use existing
semantic tokens, approved mark and44px controls; no palette/font/logo change.
Types, targeted lint and production build passed. Actual compiled local bundle
passed13 checks in BOTH Chromium and WebKit, with light/dark four-scheme
320/1440 screenshots. scripts/test-web-pwa.mjs now runs the same helper;
standalone: scripts/test-account-install.mjs [--webkit] in an isolated fixture.
Mocked account status requires serviceWorkers:block ONLY in that helper's
browser contexts; production SW caching/updates are untouched. First failed
test-waiter, stale local-build and SW-interception reports are retained, not
relabeled. Full suite and physical device installation were NOT run/accepted.
Evidence: outputs/release-tests/mobile-stable-20261022-a/account-install-{chromium,webkit}/report.json.
This was local source work, NOT a deployment or renewed publication authority.
At that point live source/version was26e6f90/93ce9f97 below. No production,
staging, migrations, Secrets, real accounts/mail, paid or native changes.

PREVIOUS LIVE FOLLOW-UP (October22,09:48TRT): application source
26e6f90e779b85eccac12b2bb1cea29f99cdb439 is live at https://birkoru.com,
Worker93ce9f97-2cf2-43d9-ab0d-9584a17c7562 at100%; maintenance OFF.
Mustafa clarified ONLY meeting-edit contents pan sideways/fields have unequal
widths and explicitly requested only critical tests and rapid publication.
New revision-bound authority is now consumed, not a standing test waiver.
Only mobile meeting-edit CSS changed: zero-minimum label grid tracks,
horizontal containment, native date width normalization and bounded textarea.
The component change adds only its scope class; submit/revision/payload,
other dialogs, desktop styling, palettes, auth and native remain unchanged.
Types, targeted lint (existing warnings only), production build, fresh audit
and source-matched minified-production WebKit18/Chromium6 layouts passed.
Long values, both venue types, equal field widths, no horizontal overflow,
save reachability and cancelled-draft data preservation were checked.
Broad suite was NOT run per this request; broader automated/manual checks
remain pending, including physical iPhone keyboard acceptance. Never relabel
the prior interrupted reports or these browser checks as physical acceptance.
All three fresh encrypted backups/disk decrypt/offline restores and exact
old schema/typed row/media/sequence comparisons passed; ZERO SQL writes or
migrations. Never replay0015/16/17/18. Shared/dedicated bindings, Secrets,
meeting mail OFF, other Workers and main preserved. Clean coauthor-free
source was pushed to the work branch BEFORE deploy. Live login200/private
API401 and actual CSS/meeting-form JS byte identity passed; no accounts/mail.
Evidence: outputs/release-tests/mobile-stable-20261022-a/meeting-edit-layout-{webkit,chromium}/report.json;
outputs/web-acceptance/26e6f90/{production-outcome,production-health}.json.
Rolloutd149d9d3-78bd-424a-aa79-0eb22b8516cd; do not rerun its private script.
Later documentation commits are not new application deployments.

PREVIOUS LIVE FOLLOW-UP (October22,00:49TRT): application source
6762dc86e40ff4728f679f001f5d41aa31fee2cf is live at https://birkoru.com,
Worker25afe82b-b410-4184-ace0-58e44a6f7865 at100%; maintenance OFF.
Mustafa's LATEST instruction explicitly stopped further broad testing and
ordered immediate publication. This is a NEW revision-bound decision for
ONLY the mobile form follow-up, now consumed; NOT general authority to skip
future tests. Main unchanged; source was clean, coauthor-free and pushed
to the work branch before deployment. Later doc commits are not app releases.

Confirmed production-only root cause: lowering a constant translate reset
does not remove Tailwind's variable-based individual translate utility in
modern browsers. The actual minified-bundle test caught -50%/-50% offsets
that Vite checks missed. Mobile Koru forms no longer emit those utilities;
desktop centering and legacy/non-form dialogs retain their existing behavior.
Mobile forms are transform-free, bounded to the visual viewport/safe-area,
focus the dialog before a deliberate field tap, keep blur/keyboard transitions
stable and preserve drafts. No palette, font, logo, backend or native changes.

14 completed automatic steps passed:294 unit tests, backend91 checks, types,
lint/build/contract, real production10 checks INCLUDING32 mobile forms,
API20 scenarios,211 existing UI checks and35 branding checks (plus existing
mobile policy/types). Separate source-matched minified-production WebKit32
layouts/64 images passed. Audit has no high/critical WEB finding; existing
low/moderate and deferred native findings remain. The full23-step suite did
NOT finish: operator-requested SIGINT cancelled legacy (its original failed
marker remains), and the later8 steps were not run. All9 unfinished automatic
and13 manual categories remain PENDING, not passed. Earlier partial/failed
runs are retained, not substituted as a passing current full suite. Physical
iPhone/Android keyboard confirmation is still required to close that acceptance.

Three fresh AES-256-GCM backups were decrypted from disk, restored OFFLINE,
and compared against every old schema/typed row/media/sequence before opening.
ZERO SQL writes/migrations; never replay0015/16/17/18. Shared readers, both
dedicated bindings, Secrets, domains, other Workers and meeting mail OFF
are preserved. No real accounts/mail, staging import, paid service or native work.
Minimal deployment health passed: login200, private API401, actual live CSS
and shared form JS bytes match the published artifact. No new broad/browser
suite, real accounts or mail. Evidence: production-health.json below.

Evidence (Git-ignored): outputs/release-tests/mobile-stable-release-20261022-r5/
{suite-report.json,web-production/report.json};
outputs/release-tests/mobile-stable-20261022-a/mobile-dialogs-production-webkit/report.json;
outputs/web-acceptance/6762dc8/{production-outcome,production-health}.json.
Rollout71670020-61ab-4629-be60-f51bf93557d2, artifact68e3a9f38e86d78440b95895d26c216d4a77f42d040f9efd2963b6aa53b2cd20.
Encrypted snapshots and separate keys remain private. Do not rerun the rollout.
The original5321 preview and user data were not reset.

### Local Investigation (Historical)

October22 REOPENED URGENT MOBILE BUG: Mustafa reports the October21 hotfix
did NOT fix his real iPhone keyboard/panning issue. Previous desktop WebKit
passes are NOT physical acceptance or proof of resolution. Work is scoped
to that same mobile form regression, not new features or general releases.
CONFIRMED production-only cause: CSS lowering folds constant translate resets
into transform, but Tailwind's variable-based individual translate utilities
remain active in modern browsers. A real minified-bundle check rejected
translate:-50% -50% even after the dev-only layout fix passed. DO NOT relax
that assertion. Form dialogs now emit those centering utilities ONLY at681px+
and no mobile utility to survive minification. Non-form dialogs are unchanged.
The6d7f0f1 full run stopped on a test's per-page participant init script;
253e90d focused production run then exposed the REAL residual translate bug.
Both original failed reports stay retained, never relabeled as passes.
Local follow-up removes mobile create-dialog centering transforms, zoom
animation AND the default200ms position/size transition. Normal-motion tests
exposed an intermediate wrong top/height that reduced-motion checks missed.
Mobile opening focuses the dialog with preventScroll, not the first input;
the keyboard opens on a deliberate field tap. Visual viewport sizing remains
through focus/blur; stale dismissal offsets are clamped and pinch zoom does
not reflow the form. Desktop and non-form dialog behavior stays unchanged.
The mandatory production-bundle step now also exercises32 real mobile form
layouts with minified CSS/JS, not only the Vite/dev server. Its geometric
identity check permits the compiler's translate(0,0) equivalent. The earlier
9c0e51b suite was deliberately interrupted to add this coverage; do not count
that partial run or its older WebKit proof as final-source acceptance.
Source, full technical gate and production checks must precede publication;
this entry does not claim a deployment. No SQL/migrations, provider, Secrets,
palettes, brand, native, staging or original5321 preview data changes allowed.
Physical iPhone keyboard acceptance and the13 manual categories remain pending.

LATEST LIVE HOTFIX (October21,23:44TRT): Mustafa's NEW urgent request with real
iPhone screenshots was deployed at https://birkoru.com. It was NOT confirmed
fixed on the physical phone; see the October22 reopened report above. Application
sourceaa6df77e14772cca67efc8ba61e437061edc0eec, Workere6d97ef8-d8c7-4803-af9c-693b3be0ebe0
at100%; maintenance OFF. Source was clean, coauthor-free and pushed to the
work branch BEFORE deployment; main unchanged. This new revision-bound urgent
authority is consumed, NOT standing approval or reuse of earlier decisions.

Reproduced sub16px portal input fonts in BOTH Chromium and WebKit: the mobile
selector covered .app-shell, not body-level dialog portals. ONLY TWO product
files changed: themes.css gives mobile portal fields16px, constrains form/grid/
label/date/file widths and provides bounded scrollable form bodies; PwaLifecycle
keeps an active bottom field visible by scrolling ONLY that form, never the
locked page/dialog or focus. Separate red/green measurement proved the bottom
field moved above the simulated keyboard with draft retained and scrollX0.
No data/business/auth/backend/native/palette/font-file/logo/dependency changes.

23/23 checks completed on identical CLEAN source and persisted synthetic data.
r1 stopped on an occupied test port after10 passing steps; r2 used5391/5392,
then timed out in web-ui after12 passing steps. Original failed reports remain.
Concurrent WebKit also had timeouts; not relabeled as passes. After closing
the temporary5331 server and running browser checks separately, the continuation
retained ONLY the12 source-matched passing steps (original report SHA verified),
reran failed web-ui211 checks plus EVERY remaining step successfully. No source
or persisted fixture reset in between. Current web audit passes without web
high/critical findings; existing low/moderate and deferred native findings remain.
Final web-refinements:12 checks/327 images, including128 actual mobile/desktop
dialog layouts, keyboard focus/draft/save access and unchanged domain records;
previous80 gallery/48 empty/32 hero layouts retained. Separate CLEAN source-bound
WebKit:128 layouts/96 images, passed. Temporary Ubuntu libs are in /tmp only,
with ignored .sites-runtime/webkit-local.sh; no system packages were installed.

Fresh encrypted backups/disk decrypt/offline restores of ALL THREE production
DBs and exact schema/typed-row/media/sequence comparison passed. ZERO SQL writes
or migrations:0018 was already present on canonical ONLY and is unchanged.
Do NOT replay0015/16/17/18. Shared readers/dedicated bindings, Secrets, production
flags/domains, staging/public-info settings and meeting mail OFF are preserved.
No real accounts/mail, staging import, provider/paid service or native work.
Post-deployment15/15 anonymous HTTPS checks passed, real JS/CSS byte matches,
16 public theme screenshots and PWA offline/reconnect; normal system DNS/TLS.

Evidence (Git-ignored): outputs/release-tests/mobile-dialog-release-aa6df77-r2/suite-report-continued.json;
outputs/release-tests/mobile-dialog-hotfix-20261021-a/mobile-dialogs-webkit/report.json;
outputs/web-acceptance/aa6df77/{production-outcome,production-smoke}.json.
Rollout dd734285-af9c-466c-89b2-54a4767a9196; encrypted backups/keys stay private.
13 manual categories remain PENDING. This is NOT physical iPhone/Android keyboard
acceptance or a passed standard manual gate. Do not reset the original5321 preview.
Later documentation-only commits are NOT new application deployments.

PREVIOUS LIVE UPDATE (October21,17:03TRT): Mustafa's new explicit "tamam canlıya
al" request has been completed. Application source86225c25216b2e74f7a6a00d2119ed8aeaf2e8ee
is live at https://birkoru.com; Workerbcdd561c-bae2-44fc-b349-d1faf74940f8
at100%, maintenance OFF. Desktop gallery spacing, first-group-only tour,
final appearance choice/account defaults, dark empty-state contrast and the
painted group image fix are deployed. Light palettes, approved logo/fonts,
native code and dependencies were not changed.

ONLY additive0018 was applied to canonical DB, adding an EMPTY account_appearance
table. Do NOT replay0018 or0015/16/17, or apply account tables to dedicated DBs.
Fresh AES-256-GCM backups of ALL THREE DBs were decrypted from disk and restored
offline;0018 was rehearsed before live SQL. Exact schema/typed-row/media/sequence
comparisons passed before AND after migration; all old data preserved. Both
dedicated bindings/shared readers, Firebase/Turnstile/session Secrets, domains,
staging/public-info settings and MEETING_MAIL_ENABLED=false remain unchanged.
No staging import, provider account/mail, paid service or main push occurred.

Source was clean, coauthor-free and pushed to work/koru-web-pwa-20261019 BEFORE
deployment. Full clean suite23/23 passed on86225c2; current web audit has no
high/critical web findings (low/moderate and deferred mobile findings remain).
The first6922193 run exposed an outdated pre-group-tour TEST expectation;
its failed report is retained.86225c2 corrected that expectation and reran ALL23
steps fresh, including22 self-service and11 refinements/231 screenshots.
The refinement step checks80 gallery,48 empty and32 actual hero layouts with
real file choosers/picture pixels. Live15/15 anonymous HTTPS checks passed:
real JS/CSS hashes, security/access,16 public theme screenshots, canonical
redirects and PWA offline/reconnect; normal system DNS/TLS, no accounts/mail.

Evidence (Git-ignored): outputs/release-tests/web-layout-release-86225c2-r1/suite-report.json,
outputs/web-acceptance/86225c2/{production-outcome,production-smoke}.json.
Private rollout ef080773-0572-40bb-a2a0-1f7398af2141; encrypted snapshots and
separate keys stay outside Git.13 manual acceptance headings remain PENDING;
this is NOT a passing standard manual gate or physical-device/provider/privileged
erasure acceptance. This NEW revision-bound publication authority is consumed,
not standing approval for another release. Never rerun the private rollout or
restore over newer writes; fix forward with new-schema readers retained.
Later documentation-only commits are NOT new application deployments.

## Earlier Local Work (Historical)

The local-only status and pending-suite notes below describe earlier snapshots;
the live outcome above supersedes them for the deployed source.

NEWEST LOCAL FIX (October21,14:08TRT): Mustafa reported the test home image not
changing. Reproduced with a REAL file chooser: upload succeeded but Notebook's
important CSS shorthand forced reading-room.webp. The old browser test checked
the reset control/hidden img, not the painted background, so missed this bug.
ReadingApp now exposes its scoped image as --group-hero-image; Notebook consumes
it while retaining its approved overlay, crop and reading-room fallback. Other
schemes/light and dark colors unchanged; Minimal still uses its existing visible
custom figure. No DB/backend/migration, logo, provider or live/staging changes.
Added group-hero-checks.mjs/test-group-hero.mjs; mandatory web-refinements calls
the same stronger check. Local red/green evidence in
outputs/release-tests/tour-timing-20261021-c/group-hero:32 custom/default layouts,
33 screenshots, real desktop/mobile chooser uploads, actual picture-pixel change,
reload, same-file replacement and unreferenced-media cleanup. The failing
pre-fix report is retained. Four real workerd/D1 isolation/media tests, tsc,
UI contract and production build pass; lint retains only the5 existing warnings.
Earlier full-screen/tour reports below predate this image fix; the whole release
suite has NOT been rerun or waived. Still dirty/unpublished. The5321 preview's
data and any user-selected images were NOT modified by tests; separate synthetic
test media/settings were cleaned/restored. No migration is needed for this fix.

NEWEST LOCAL DECISION (October21, supersedes zero-group tour behavior below):
Mustafa wants the tour only AFTER first successful group creation and real home
load, not immediately after signup. Removed WelcomeTour/providers from /groups
and /groups/manage; removed unused setup-mode tour. ReadingApp requires a real
loaded group and matching member. First invitation join follows the same rule.
Appearance choice stays the final step; completed/dismissed version1 accounts
are not forced through it again. Added failed-create/no-consumption and actual
create/join browser checks, updating the older registration test expectation.
Fixed overlooked hardcoded empty-panel heading in ALL dark schemes with shared
semantic heading/body/icon/border roles; light colors/palettes remain unchanged.
New 48 empty Home/Archive/Plan layouts measure contrast at390/1440; brandv1.5
records the approved timing and readability contract. Prior23-step evidence
below predates this change and is NOT current-source verification.0018 remains
LOCAL ONLY; no deployment, live SQL, paid service or native work by this task.

NEW LOCAL VERIFICATION (October21,13:58TRT): current product passes13 focused
unit checks, tsc, UI contract and production build; targeted lint has no errors
(ReadingApp retains its5 pre-existing img/hook warnings). Playwright:43 main
experience checks/96 screenshots +8 extra/16,211 existing four-theme screen and
profile checks,11 refinements/199 screenshots including48 empty Home/Archive/
Plan layouts and80 empty/populated meeting layouts. Dark heading minimum16.10:1,
body/icon11.12:1; light text colors and original light palettes unchanged.
Reports: tour-timing-20261021-a/{web-experience,groups-ui} and
tour-timing-20261021-c/web-refinements under outputs/release-tests. Earlier
test-selector/setup failures are not passes; the b failed report is retained.
These focused checks do NOT constitute a new23-step release or manual gate.
The self-service registration expectation was updated to no pre-group overlay;
the complete self-service suite was not rerun in this focused task. Current
application changes remain dirty on86e0492, not committed/pushed/deployed.
Only the original5321 synthetic preview is left running, with its existing
layout-onboarding-20261021-b data/password preserved, not reseeded.

LATEST LOCAL WORK (October 21, after the live77a69c5 release): Mustafa reported
desktop gallery commands touching the divider and requested checking every theme,
plus a first-account appearance choice AFTER the tour. Implemented notebook
desktop32px main-column inset, stacked-tablet divider removal, shared16px section
heading wrap/gap and8px gallery-command gap. Light/dark PALETTES unchanged.
Added an explicit four-scheme +light/dark/system final step, server-confirmed
save/retry, account-owned default and chosen membership/tour atomic save. Existing
group preferences are not overwritten in bulk; newly created/joined groups inherit
the account default. Keep tour version1: no forced replay for completed accounts.
Brand contract v1.4 adds these interaction/spacing rules, not a new logo/palette.
NEW0018 account_appearance is CANONICAL ONLY and is NOT applied to production.
Old-schema fallback keeps existing tours/groups working. Account erasure cascades
the new preference. See WEB_LAYOUT_ONBOARDING.md for contracts and test inventory.
No new live/staging SQL, deployment, mail/provider/DNS/Secret, paid service or
native change is authorized/performed by this task. Earlier deployment requests
are consumed, not standing authority. Live baseline below remains authoritative.

LOCAL VERIFICATION completed October 21,09:39UTC:23/23 steps passed on unchanged
product source (tested digest d2ff7cd0e7096e28104f923729fc93092e0eec4db5857415881434216a74c622,
dirty HEAD86e0492). Original r3 was interrupted after16 passing checks; preserved
that report and continued ONLY the remaining7 against the identical source/data.
Combined evidence: outputs/release-tests/layout-onboarding-suite-20261021-r3-continued/suite-report.json;
new feature evidence: corresponding r3-refinements/web-refinements/report.json.
Includes80 empty/populated gallery layouts,150 focused screenshots,43 experience
checks/96 images,8 extra experience,59PWA and211 existing full-screen/profile
layout checks. Native/device/provider acceptance is NOT established. Doc-only
verification notes were added AFTER this test; product fingerprint was retained
in ignored .sites-runtime/layout-onboarding-verified-product.json. The dirty tree
and pending manual evidence still block the normal publication gate.
Preview5321 uses isolated profile layout-onboarding-20261021-b; demo.welcome is a
synthetic account for first-group onboarding (its tour/memberships are NOT reset;
same generated local password as demo.multi, ONLY in the ignored settings file). Never reveal its
sessionSecret. Earlier previews/data were not reset.0018 remains LOCAL ONLY.

LATEST LIVE UPDATE (October 21,10:06TRT): Mustafa requested publishing the seven
web refinements after the local handoff. Source77a69c5 is live at birkoru.com,
Worker70d23f67-3946-4213-8755-548bbaf4d5a7 at100%, maintenance OFF. Implemented
automatic zero-group first-account
tour; optional online/in-person meeting venue in create/edit/continuation; opt-in
group-scoped change mail, notifications and versioned calendar; admin group hero;
separated onboarding links; all four dark palettes; readable body text. Preserve
approved logo/default image, light COLOR palettes, accounts and existing behavior.
Native remains deferred. See WEB_REFINEMENTS.md and MEETING_MAIL.md.

Palette contract from BRAND_IDENTITY.md v1.3 (retained in v1.4): dark canvas15191b, surfaces20272b/
2b363c, textf0f5f7, mutedbed0d8, border748e9b; editorial actionffa28d,
catalogue7ee2b7, notebook8cd9e8, minimalf0f5f7. Body16px, meta14px; keep notebook
structure independent. Approved light palette snapshot is an enforced test fixture.

Mustafa chose preparing a FREE domain-verified sender for birkoru.com. Resend
MEETING_MAIL_* is separate from Firebase auth/Gmail secrets; no real provider
account, DNS/Secret or mail operation was performed for this update. Membership,
verified address and opt-in are rechecked; unique leases, 429 deferral, uncertain
outcomes/no blind resend, private one-recipient messages and 30-day cleanup.
Activity-driven queue, NOT guaranteed inactive-group cron or background web push.
Account-owner sender setup and production acceptance stay in final handoff only.

APPLIED additive SQL:0016 DOMAIN tables on canonical/default AND both existing
dedicated DBs;0017 CANONICAL ONLY for shared metadata and preferences/deliveries.
Do not rerun0015/0016/0017 or apply0017 to dedicated DBs. Three FRESH encrypted
backups, disk decrypt/offline restore and exact old schema/typed rows/BLOBs/
sequences comparison passed before opening. No staging import, synthetic remote
account/mail, provider setup, Secret change, paid service or main push. All23
clean revision-bound suite steps and15 anonymous live HTTPS checks passed.
13 manual acceptance headings remain pending, NOT retroactively passed. Mustafa's
new request applies to this release only; earlier exceptions remain consumed.
Future releases require the normal gate or new explicit authority. Meeting mail
flag is false; owner sender steps remain in MEETING_MAIL.md. Physical-phone,
real provider/calendar and erasure acceptance are not established by Chromium.
The older priority/DNS/logo holds below are historical, overridden by dated
publication entries, not a claim that production remains on workers.dev.

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

## October 20 Shared Group Storage Is LIVE

- Source d6a1c4d720317c29c0fd366afb7582ab32f07ebf, digest
  e4d1c36d4879fe931b33493780702894a03cf9ff12d9fa3119934ab08e1bc10d;
  coauthorless400c714 +d6a1c4d pushed to work/koru-web-pwa-20261019 BEFORE
  deployment. Main unchanged. Later docs-only commits are not new app builds.
- Clean d6a1c4d full suite PASSED21/21,269 root unit tests,91 backend/20API,
  211 visual/layout,35 branding,22 self-service,59PWA,27+8 experience,4updates,
  types/build and lint0errors/16existing warnings. Fresh audit passed no WEB
  high/critical; low/moderate and deferred native findings remain.
- New rollout838d658f-46c7-4fe5-8f42-ff773d4233e8 reached opened at
  2026-10-20T20:18:07Z. Canonical backup cdfc3f87-d1b1-49c8-8609-abf4c11c1725:
  encrypted export, decrypt/offline restore verified, Worker settings/deployment
  and DB identities unchanged during backup. No temporary restore DB created.
- ONLY additive0015 applied after maintenance/drain/offline rehearsal; every
  prior schema/typed row/BLOB/sequence compared before/after. No existing group
  data moved/reset, no staging import, no Secrets or paid plan/provider account/
  test-mail changes. Both dedicated group bindings remain even if occupied.
- Live Worker fc31de5a-5c8f-4e7b-9645-81f151453374 at100%, deployment
  e79c6321-481a-47b7-a752-b7707114bc6c. SHARED_GROUPS_ENABLED=true,
  SELF_SERVICE_GROUP_BINDINGS=[], maintenance=false, three D1 bindings and14
  shared canonical tables. Postflight required runtime/schema blockers ZERO.
- New groups use canonical tenant tables, no per-group pool slot. Existing
  default/dedicated readers remain. GLOBAL three-group limit removed; per-owner
  three-created-group /twenty memberships and service storage/CPU quotas remain.
- Anonymous production HTTPS smoke PASSED14checks at20:18UTC with normal system
  DNS/TLS: public docs/security headers, exact approved C icon/social bytes,
  Firebase/Turnstile config, private/operator rejection, foreign/empty signup
  rejection, canonical redirects, real hydration390/1440light/dark, no overflow/
  page errors, public-only cache/offline/reconnect. Zero accounts/mail created.
  Inspected mobile dark and desktop light screenshots. These are NOT real
  production password/provider-mail or physical-phone/operator acceptance.
- Evidence Git-excluded: outputs/release-tests/shared-groups-clean-d6a1c4d/,
  outputs/web-acceptance/d6a1c4d/production-outcome.json and production-smoke.json;
  private shared-rollouts journal and backup/key dirs. NEVER commit user data.
- The separate explicit shared-update exception is now CONSUMED. Thirteen manual
  categories remain pending; standard gate did NOT pass and future releases
  cannot reuse either earlier exception. Do NOT rerun0015 or first-launch SQL.
  Once shared groups exist, keep shared readers enabled; to mitigate problems
  pause only new creation with GROUP_CREATION_DISABLED=true. No restore over
  newer users/content or rollback to shared-unaware binary.
- Dated architecture diagrams/counters describe17:52TRT pre-shared snapshot;
  prominent latest-update notices point to SHARED_GROUP_STORAGE.md. Do not
  interpret their old two-pool illustration as a current global capacity limit.

## October 21 Web Refinements Are LIVE

- Mustafa's newest instruction was "tamam canlıya al" after the handoff explicitly
  distinguishing local checks from missing sender/device acceptance. Recorded a
  NEW source/migration-bound publication request, not replay of either consumed
  October20 exception. Standard manual gate remains false;13 categories pending.
- Deployed source77a69c50d58d55113b6a9ae2b1faeccdac5db713, digest
  4a530413cfd7fd0e669a96c3fafc19b60ba9d0c9026d369852cee4bd8ac6f96f.
  Already clean and coauthorlessly pushed to work/koru-web-pwa-20261019; main
  untouched. Reused its still-fresh23/23 suite and matching dependency audit;
  web high/critical ZERO, low/moderate/deferred-native findings still remain.
- Built the production artifact from that exact source. Read-only preflight
  verified baseline/shared readers, all three DB identities, no partial new
  schema, no pending erasure and unchanged runtime configuration. Deploy dry-run
  and local canonical/dedicated preservation/replay-rejection rehearsals passed.
- Rollout fdc40b90-f81e-428a-8feb-6f4496a4da84: verified maintenance503, drained
  writers60s, exported ALL THREE production DBs to separate encrypted disk
  snapshots/keys. Disk decrypt, full offline restore, FK/integrity and additive
  migration rehearsal passed for each. No extra remote DB or test user created.
- Applied0016 in DB/GROUP_CREATE_ONE/GROUP_CREATE_TWO,0017 only in DB. All original
  schema/typed rows/media/hash/sequence values compared BEFORE and AFTER every
  additive batch. Six new tables canonical/two per dedicated, initially empty.
  Never rerun migrations or restore a snapshot over newer production writes.
- Opened2026-10-21T07:06:38Z, Worker70d23f67-3946-4213-8755-548bbaf4d5a7 at100%,
  deployment88f4df21-aecc-4084-a606-bb6119b5ebba. Three bindings and existing Secret
  names preserved. Shared mode true, pool list[], maintenance false, new meeting
  mail false. No Firebase provider/account-mail, DNS or paid-service changes.
- Live anonymous HTTPS smoke PASSED15 checks, normal system DNS/TLS: public docs,
  CSP/no-store, approved logo assets, Firebase/Turnstile configuration, protected
  old/new APIs/operator, empty/foreign signup rejection, canonical redirects,
  private-safe metadata, served JS/CSS byte matching, hydration, four schemes x
  light/dark x390/1440 (16 screenshots), anonymous-only PWA cache/offline/reconnect.
  Inspected mobile notebook dark/desktop editorial light. Initial smoke selected
  /assets instead of vinext's actual /_next/static; failed report retained, test
  corrected, then genuinely passed. No production account/mail experiment.
- Evidence Git-excluded: outputs/release-tests/web-refinements-r7-20261021/,
  outputs/web-acceptance/77a69c5/production-outcome.json and production-smoke.json,
  private refinement-rollouts journal and separate backup-keys. Keys, snapshots,
  personal rows and operator credentials NEVER belong in Git/docs/chat.
- Sender verification/Secret, real mailbox/calendar behavior, scheduled inactive
  group delivery and physical Android/iPhone/manual operational/legal/security
  acceptance remain. Do NOT imply deployed meeting mail currently sends. This
  update did not migrate staging, change light palettes/logo, reset data, create
  paid resources or publish native code. Later docs-only commit is not deployed.
- Recovery: new features may have written real data after opening, so fix forward
  with shared readers and online metadata support retained. Mail stays off. Do
  not silently roll back to an online-unaware reader, drop new tables or restore
  over newer writes. Pause writes/creation for explicit operator review as needed.
