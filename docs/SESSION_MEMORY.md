# Koru Project Session Memory

Last decision update: 2026-10-19. Read this at the start of future sessions.
This is durable repository memory, not a claim that account-wide AI memory
or every external assistant has been updated. AGENTS.md enforces the read order.
Never store credentials, private email links, tokens or real user records here.

## Current Priority

1. Launch the mobile-first web app and installable PWA first.
2. Establish professional identity, private-safe link previews and security gates.
3. Return to native Android/iOS only after web acceptance. Native work is deferred,
   not deleted; do not treat browser checks as native proof.

User: Mustafa Özgör. Product: Koru. Support: koru.destek@gmail.com.
Domain budget is not chosen: show candidates, first-year AND renewal prices first.
No purchase, paid service, production migration, deployment or auto-deploying push
without the corresponding explicit approval.

## Required Reading

- `BRAND_IDENTITY.md`: binding cross-platform identity and four-theme contracts.
- `WEB_RELEASE.md`: launch blockers, browser/device acceptance and release gate.
- `DOMAIN_OPTIONS.md`: dated price/registration research, not an availability promise.
- `STAGING.md`, `WEB_ONBOARDING.md`, `USER_DATA.md`: infrastructure and account flows.
- `WEB_EXPERIENCE_ACCEPTANCE.md`: eight-item PWA/user-experience plan and reused evidence.
- `WEB_LAUNCH_STATUS.md`: October 19 web-only launch report, blockers and commit/push vs deployment distinction.
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

- Permanent domain and HTTPS origin not selected; no purchase authorized.
- Gmail OAuth is a temporary testing setup with a seven-day guard. Do not extend
  the guard date to manufacture production readiness.
- Password storage currently PBKDF2-SHA256/100,000 due to Workers constraints;
  modern cost/migration/runtime budget review is a production blocker.
- Group provisioning uses finite preallocated databases, not unlimited signup.
- Production migration inventory, rollback and backup RESTORE drill unapproved.
- General-use privacy/terms, deletion/export/retention and biometric consent unresolved.
- Strict script CSP/nonces and independent security review not established.
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
  Cross-D1 erasure, last-owner transfer, restore replay and operator queue remain
  launch blockers. No remote account/group data was deleted in this work.
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
