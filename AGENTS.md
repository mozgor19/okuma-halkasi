# Project Rules

## Session Read Order

- At the start of every session, read `docs/SESSION_MEMORY.md` and `docs/BRAND_IDENTITY.md`.
- Before release, PWA, public metadata or security work, also read `docs/WEB_RELEASE.md`.
- Current priority is mobile-first web/PWA launch. Native Android/iOS work is deferred until web acceptance.
- Preserve the Koru identity on every platform. Update the identity document and project session memory when an approved brand decision changes.
- Missing release evidence blocks publication. Do not turn a passing local suite into a production-readiness claim.
- Exception recorded October 20, 2026: Mustafa explicitly requested the first public birkoru.com launch with best-effort safeguards instead of a six-account opening. Use the separate revision-bound first-launch decision; keep outstanding manual checks pending. Never waive failing automated checks, audit, origin, data-preservation or security configuration. This does not relax the standard gate for later releases.
- That first-launch exception was consumed by the October 20 birkoru.com deployment (source `1c1b235`). It is not standing approval for subsequent deployments. See the latest launch outcome in `docs/SESSION_MEMORY.md` and `docs/FIREBASE_PRODUCTION.md`; do not rerun completed production migrations.
- Later October 20, Mustafa explicitly accepted the stated13 pending manual criteria ONLY for the shared-group-storage update. Use its separate revision/migration-bound `shared-update-policy.mjs` decision, not the first-launch decision. Clean pushed work-branch source, full passing suite/audit, exact production identity, fresh encrypted backup and old-data preservation remain mandatory. Keep pending checks pending; this is not general approval for later changes.
- That shared-storage exception is now consumed: production source `d6a1c4d`, Worker version `fc31de5a-5c8f-4e7b-9645-81f151453374`, 0015 applied and shared mode enabled. Both older dedicated DB bindings remain. Do not reapply 0015 or roll back to a shared-unaware reader; pause creation with `GROUP_CREATION_DISABLED=true` while keeping shared readers enabled. Future releases require the standard gate or new explicit authority.

## Icons

- Use [Hugeicons Animated](https://hugeicons-animated.com/) for application icons whenever a matching animated icon exists.
- Install animated icons as source components with `npx shadcn@latest add @hugeicons-animated/<icon-name>` and expose them through `components/icons.tsx`.
- When the animated set has no semantically correct icon, use `@hugeicons/react` with `@hugeicons/core-free-icons` through `components/icons.tsx`.
- Do not add new `lucide-react` imports or introduce a second icon family.
- Preserve accessible labels and `prefers-reduced-motion` behavior for icon controls.

## Theme Architecture

- Keep theme styling in three layers: scheme palette tokens (`--app-*`), semantic role tokens (`--color-*`, `--control-*`, `--tab-*`), and component selectors.
- Components must consume semantic role tokens. Do not put raw color values or scheme names in shared component color rules.
- A new scheme normally defines only its `html[data-scheme="<name>"]` palette. Add a matching dark palette only when its brand accent differs from the shared dark palette.
- Do not add per-scheme component patches to repair readability. Fix the shared semantic role or component contract so every scheme benefits.
- Keep light and dark palettes independent. Dark mode is activated by the root `.dark` class; do not derive it by inverting the light palette.
- Use `--color-action` for interactive text and icons, `--color-text-muted` for secondary copy, and the `--control-*` or `--tab-*` roles for their named components.
- Maintain at least WCAG 4.5:1 contrast for body text and 3:1 for controls, indicators, and focus rings.
- SVG icons must use `currentColor`; never invert photographs for dark mode.

## Notebook Direction

- Treat the notebook direction in `/design-lab` as the visual source of truth for `data-scheme="notebook"`.
- Preserve its product grammar in production: desktop top navigation, mobile bottom navigation, ruled paper and margin line, yellow labels, outlined commands, ledger rows, and divided profile statistics.
- Do not reduce notebook to decorative colors or shadows on the default card layout. Adapt every live feature into the notebook grammar without removing functionality.
- Keep notebook-only structure behind scheme-scoped classes so editorial, catalogue, and minimal remain independent.
- Before shipping notebook changes, verify light and dark modes at 1440px desktop and 390px mobile widths, including Home, Plan, Meeting, and every Profile tab.

## Mobile Work

- Before planning or implementing iOS/Android work, read `docs/MOBILE_HANDOFF.md` and `docs/MOBILE_ACCEPTANCE.md`, then verify their inventory against the current code.
- Preserve the existing web app, accounts, backend data, all four schemes, and feature parity. Document the mobile architecture decision before introducing a framework.
- Track iOS and Android verification separately in the acceptance checklist. Do not equate web/PWA checks with native validation or claim untested features are complete.
- Keep server secrets out of mobile bundles and documentation. Verify production migration state before applying SQL; local success does not establish production readiness.
