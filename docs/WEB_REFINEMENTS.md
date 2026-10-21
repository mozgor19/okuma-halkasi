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

## Release Outcome: October 21

Mustafa subsequently explicitly requested publication after the local handoff.
Application source77a69c5 is now LIVE at birkoru.com, Worker
70d23f67-3946-4213-8755-548bbaf4d5a7 at100%, maintenance off. Its clean23-step
suite and matching audit passed; the production artifact was rebuilt from that
source. All three DBs had fresh encrypted disk backups/decrypt/offline restore
and additive rehearsals.0016 applied to all three;0017 CANONICAL ONLY. Old
schema/typed rows/BLOBs/sequences matched exactly before/after. Never replay
0015/0016/0017 or import staging. New tables were empty before opening.

All15 anonymous live HTTPS/browser checks passed, including served JS/CSS byte
matching, four schemes x light/dark x390/1440 and PWA offline/reconnect. Evidence
is under outputs/web-acceptance/77a69c5/; snapshots/keys stay private/Git-excluded.
No remote test accounts/mail, Secret/DNS changes, paid service, native change or
main push. Existing public authentication and mail configuration were retained.
Meeting change mail remains OFF until real sender setup/acceptance.13 manual
acceptance headings stay pending; the standard manual release gate did NOT pass.
This publication request is this release only, not reuse of older exceptions or
standing future authority. See FIREBASE_PRODUCTION.md and SESSION_MEMORY.md.

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
- Real provider delivery, installed physical Android/iPhone and external calendar
  update behavior are NOT proven by local Chromium. Live additive schema rollout
  was separately completed/verified in the publication recorded above.
  No new logo/default-image assets or light color declarations were changed.

Remaining owner steps are in `MEETING_MAIL.md`, including provider Free/DNS/Secret
and real delivery acceptance. SQL is already applied; do not rerun it or silently
deploy under an old publication decision.
