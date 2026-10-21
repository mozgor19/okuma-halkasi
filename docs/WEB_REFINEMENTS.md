# Web Refinements: October 20-21, 2026

Mustafa requested seven ordered improvements: automatic first-account tour,
online/in-person meetings, consent-based change mail and notifications/calendar
updates, per-group home image, separated onboarding actions, richer dark modes
without changing light palettes, and readable body typography. A later message
asked for autonomous completion; any unavoidable account-owner actions belong
only in the final handoff. Native mobile is not being changed.

## Implementation Contract

- Keep approved logo, default reading-room image, light COLOR palettes, all four
  scheme structures, accounts and tenant boundaries. Typography may improve in
  both modes. New dark colors require brand document/memory updates and contrast
  plus screenshot regression. No fresh brand assets are needed.
- Tour first entry covers both zero-group selection and group management. Completion/
  dismissal stays account-owned and persisted; replay remains available.
- Additive0016 creates domain meeting_details/change_events in the canonical
  legacy domain AND each existing dedicated DB. Additive0017 is CANONICAL ONLY:
  shared equivalents with composite tenant FKs plus opt-in/delivery ledgers.
  Existing meeting rows are not rewritten; absent metadata means in-person.
  Missing new schema disables only new features, not old state or forms.
- All extension reads/writes explicitly carry tenant scope. A meeting update,
  optimistic revision check and change-event insert share one domain transaction.
  No-op saves do not send mail; stale edits return conflict. Online links are
  optional, bounded HTTPS links without URL credentials/control characters.
- Change notification is in-app and, only with device permission, a device
  notification while the app is active. This is not a new background push service.
- E-mail is OFF by default per account/group, verified addresses only. Recheck
  active membership, consent and erasure freeze before sending. No To/CC roster.
  Canonical ledger atomically claims bounded batches with unique leases;
  ambiguous provider outcomes are not automatically resent. Acceptance is not
  mailbox delivery. Activity-driven background drain and an admin retry retain
  pending work; a permanently inactive group still needs scheduled operation.
- Mustafa chose a FREE domain-verified sender for birkoru.com. Prepare separate
  Resend-compatible MEETING_MAIL_* configuration; do not repurpose Firebase,
  staging Gmail or account-mail secrets. Real provider account/DNS/Secret setup
  and delivery acceptance are not simulated as done. No remote mail is sent here.
- Mail links open the protected meeting and current calendar download. Keep the
  existing event UID, add SEQUENCE/LAST-MODIFIED and fold UTF-8 iCalendar lines.
  External calendars cannot be silently edited without their own authorization;
  recipients are told to import/update their existing record as appropriate.
- Group image upload/reset is admin-only, private group media, bounded raster
  image types, client normalization, atomic image/settings write and safe cleanup
  of replaced unreferenced media. Missing/deleted image falls back to default.

## Release Boundary

Production remains source d6a1c4d with0015. Prior one-time exceptions are consumed.
This task is implementation/local verification, NOT a new live migration, batch
mail authorization, staging data import, paid plan or main push. A subsequent
release needs fresh evidence, backups, reviewed multi-DB0016/canonical0017 plan
and separate operator authority. Never rerun already applied0015.

## Verification

- Focused backend tests cover additive row/media/hash preservation, tenant FKs,
  optional/unsafe online URLs, create/edit/continuation, optimistic conflict,
  rollback/no-op, stable calendar UID/UTF-8, opt-in, membership revocation,
  unverified addresses, HTML escaping, provider uncertainty/429, erasure cascade
  and protected group-image upload/reset. Real workerd tests exercise concurrent
  revisions and the D1 SQL, not only an in-memory adapter.
- Local Playwright `web:test:refinements` covers zero-group automatic tour and
  persisted completion; actual create/edit/upload/reset forms; unchanged light
  palette; four schemes x two modes x390/1440 and separated44px onboarding links.
  The first focused run passed6 checks/69 screenshots in
  `outputs/release-tests/web-refinements-20261020/web-refinements/report.json`.
- The regression suite now REQUIRES `web-refinements` as a release step, alongside
  existing Home/Plan/Meeting/all Profile tab checks. Its real pass/fail result,
  source identity and logs are in the chosen run's `suite-report.json`; never
  treat this documentation as a substitute for that result or manual acceptance.
- Release servers use separate Wrangler/Miniflare registries per run and role;
  repeating Worker names cannot select an existing developer preview's registry.
  Preserve failed/interrupted trial reports rather than rewriting them as passes.
- Refinement browser scenarios get their own fresh child fixture/profile after
  the existing account/PWA suites. Real security counters remain enforced;
  synthetic login traffic neither resets counters nor exhausts another suite's
  shared loopback budget. Child reports remain under the release output tree.
- Separate synthetic preview: `http://127.0.0.1:5314`, profile
  `web-refinements-20261020`. Demo accounts `demo.multi`, `demo.single`, `demo.none`;
  the generated password is only in the ignored local settings file. Existing
  developer preview46603 was not stopped, reset or reseeded.
- Real provider delivery, installed physical Android/iPhone, external calendar
  update behavior and live schema rollout are NOT proven by local Chromium.
  No new logo/default-image assets or light color declarations were changed.

Next operator steps are in `MEETING_MAIL.md`, including provider Free/DNS/Secret
and additive multi-DB migration/rollback boundaries. Do not ask the sleeping user
for incremental setup or silently deploy under an old exception.
