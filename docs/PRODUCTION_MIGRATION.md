# Koru Production Data Transition

October 20, 2026. Mustafa explicitly selected: preserve the EXISTING live data;
do NOT move staging accounts, groups or fixtures. The destination web origin is
`https://birkoru.com`. Going live is requested, but security/release checks must
still pass. Final selected C logo integration was explicitly authorized on
October 20. Paid plans remain forbidden. Separate production Firebase project
ID reported by the operator: `koru-951bf`; no test identities may be adopted.

## Data Boundary

- Keep the canonical production D1 identity
  `bbb0e55c-a354-4983-89e5-59b62eb3276a` and existing primary/foreign keys.
  A domain change does not require copying books/photos into a different DB.
- Preserve every existing table value, password hash, session version, member
  role, media byte and autoincrement high-water mark. Do not re-run 0000-0007
  on production: 0006 changes roles and those migrations already exist.
- Add canonical migrations 0008-0013 only after exact source-schema validation.
  Additional NEW empty domain databases must not receive canonical account,
  recovery, experience or erasure tables. Never use occupied staging pools.
- Backfill the default group's membership/local-account mapping for existing
  non-guest members, without changing their IDs or roles. Guests remain guests.
  Preserve the current `LEGACY_GROUP_NAME`, not the placeholder `Okuma Halkasi`
  from 0008. This does not rename other/new groups or the public product Koru.
- A new origin has separate cookies/PWA storage: users must sign in again.
  Tokens and old-origin cookies are never copied through query parameters.

## Offline Rehearsal

```bash
nvm use 24
corepack pnpm web:migration:rehearse --backup-id=BACKUP_UUID
```

This command has NO authentication, network, arbitrary source/target, live apply
or restore option. It opens the existing authenticated encrypted backup in memory,
never writes plaintext SQL/user data to disk, and records only aggregate evidence
inside `.sites-runtime/koru-production/migration-rehearsals/` with private access.
Exact legacy catalog/schema, foreign keys and integrity are checked first.
Unknown/partial/already-migrated schemas are refused, not dropped or guessed.
All new tables/seeds are one local transaction, including post-change validation;
a failure rolls everything back. Existing schema, values/types/bytes, sequences
and expected membership IDs must match. Unrelated new tables must be empty.
The Firebase environment marker must be exactly `(1, 'koru-951bf')`; the
registration/link/session tables must be empty. Adding provider metadata does
not import any identity or modify the existing passwords.

Historical real-backup rehearsal PASSED for backup
`7903973b-2169-42cf-9401-414b53a17ec0` (exported October 19):
13 original tables/75 rows including 17 media records unchanged, 16 added tables,
six original accounts and default memberships retained. Private report:
`.sites-runtime/koru-production/migration-rehearsals/01fff960-3ac7-453f-bbb5-7f4a19ab892a.json`.
Ten synthetic regression tests cover preservation, exact scope, interruption,
rollback, same-count corruption, PII-free reporting and invalid CLI arguments.
This is offline SQLite evidence, NOT remote D1 migration or release acceptance.

Updated offline rehearsal including 0013 also PASSED on the same historical
encrypted backup: all 13 original tables/75 rows/17 media and six accounts
unchanged, 20 added tables, zero automatic identity imports. Report:
`.sites-runtime/koru-production/migration-rehearsals/600db719-346d-4dfd-aaf7-dabcdec1849c.json`.
No remote requests/live writes. This does not replace a fresh cutover backup.

## Existing Account Claim

All six accounts match the known legacy 100k hash FORMAT. This is not a password
verification and does not prove import compatibility. There are ZERO verified
email profiles in this legacy snapshot. Therefore automatic Firebase imports
are ZERO; no guessed email, name-based match or shared operator email may be
used to bind those identities. Account contents remain in D1 regardless.

Before real provider migration, review an account-claim flow that proves BOTH
the old account (existing password/current authenticated session with recent
reauthentication) and the new verified provider identity. Protect it with unique
UID/account constraints, CSRF, rate limits, replay resistance and transactional
linking; never accept a caller-supplied member ID or matching email as proof.
Document owner-assisted recovery for users unable to prove their old account.
Submit the real account transition plan to Mustafa before transfer.

## Cutover Order

1. Complete the separate Spark TEST project, synthetic remote authentication
   and real email tests; implement and verify the application/session bridge.
   No real account is sent to the test project.
2. Finish operational erasure, quotas, legal/provider disclosures and the
   revision-bound release/device evidence. Keep biometrics disabled.
3. Prepare the exact domain/Worker/Turnstile/canonical/mail-origin config and
   separate empty production group DBs, without staging promotion.
4. At the migration window, enforce stopped writers, take a FRESH backup and
   verify the source schema/data against it. Historical evidence is not a
   snapshot of later writes. Validate backups/keys and rollback ownership.
5. Run only reviewed additive SQL as an atomic guarded operation. Keep feature
   flags closed until all original values/media/memberships/FKs are verified.
   This repository currently has NO production SQL apply command.
6. Transfer only reviewed identities after approval; then controlled release,
   domain HTTPS smoke/account/PWA checks, monitoring and controlled opening.

October 20: the operator declined the proposed additional isolated remote
Worker/D1/account/mail test. Do not create it or equate local acceptance with
real-provider Koru/Free-runtime evidence. This refusal does not authorize
fabricating proof, bypassing the release gate or erasing provider identities.

Do not restore an old D1 over later writes as an application rollback. After
passwords move to a provider, reverting to old local hashes is not safe. Forward
repair/maintenance and deletion-ledger replay need their own verified procedure.
