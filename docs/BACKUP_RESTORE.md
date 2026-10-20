# Koru D1 Backup and Restore Drill

October 19, 2026. Mustafa approved a private local backup of the current live D1
and restoration into a NEW database bound to NO Worker. This does NOT approve
production SQL/restore/deployment, Firebase, domain changes, signup or paid plans.

## Verified Result

- Native point-in-time export succeeded. AES-256-GCM encrypted disk backup was
  reopened with its separately stored 0600 key; authenticated content matched.
- Local and genuine REMOTE D1 restore passed. All values in 13 tables and the
  complete bytes/types of 17 media records matched. Schema, autoincrement
  sequences, foreign keys and quick_check passed.
- Restore plus verification: 5.474 seconds in this run. Preparation, export,
  creation, cleanup and app recovery are excluded; this is NOT an RTO SLA.
- Temporary D1 deleted/absence verified. Existing six DB identities and all
  inventoried Worker settings/deployments unchanged. Zero source mutation SQL.

Successful private evidence:
`.sites-runtime/koru-production/backups/64c2e38a-5cc6-4de2-aa1d-8b2a116dba9a/report.json`.
Backup ID: `7903973b-2169-42cf-9401-414b53a17ec0`.
Exported `2026-10-19T20:36:51.171Z`; drill completed `2026-10-19T20:44:01.033Z`.
This is a historical snapshot, not later writes. Earlier failed reports remain
failed; their temporary targets were also removed.

## Manual Commands

Node 24 and explicit operator approval are required. Never run the remote drill
in CI: it processes real data and consumes D1 resources.

```bash
nvm use 24
corepack pnpm web:backup:drill --confirm=production-backup-and-isolated-restore
```

Restore an existing encrypted backup without another live export:

```bash
corepack pnpm web:backup:drill --confirm=production-backup-and-isolated-restore --backup-id=BACKUP_UUID
```

There is NO production restore command, arbitrary source or existing target option.

## Private Storage

Ciphertext/reports: `.sites-runtime/koru-production/backups/<run-id>/`.
Separate key: `.sites-runtime/koru-production/backup-keys/<backup-id>.key`.
Provider diagnostics, when needed, are encrypted with a separate diagnostic key.
Folders are 0700, files 0600; existing files aren't overwritten, key/backup file
symlinks are refused. Everything is Git-ignored, not a public CI artifact.

Backups include password hashes, photos and personal text. Never expose their
contents, keys or signed export URLs in terminals, issues, Git or AI services.
Both key and ciphertext are still on the SAME computer: device-loss recovery,
off-device key custody and retention/deletion schedules remain open decisions.
API absence proves temporary D1 deletion, not instant physical provider erasure.
Native export has temporary provider staging artifacts; signed links aren't logged.

## Guardrails and Verification

Source account/DB are pinned. Existing targets and Worker-bound databases are
rejected. Count/storage must fit Free capacity bounds; this drill additionally
bounds source/download size, rows, statement lengths and restore request size.
Subscription metadata was 403: billing wasn't independently verified. No billing
API mutation, paid-plan activation or quota increase occurs. Remaining daily
quotas aren't independently verified; quota/provider errors stop, not upgrade.

SQLite parses the native dump in memory, not by splitting SQL strings. Offline
parsing accommodates child-before-parent order, then checks every FK. Actual
restore uses enabled/deferred FK enforcement in one official D1 query batch.
Text/BLOB hex encoding preserves Unicode/NUL/bytes; decimal strings preserve
int64. Large values are assembled in a temporary chunk table to respect statement
limits; that table is removed before verification. Indexes/views/triggers and
sequence high-water marks are restored without firing triggers during data import.

The native FILE-import service returned D1_RESET_DO twice. Both targets were
removed and those reports remain failed. Successful restoration used documented
`{ batch: [{ sql }] }`, not a production reset, changed etag, suppressed integrity
failure or disabled remote FKs.
[Query API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/),
[import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/),
[FK enforcement](https://developers.cloudflare.com/d1/sql-api/foreign-keys/).

Eight synthetic tests cover explicit CLI approval, crypto tampering, target/binding/capacity guards,
parser isolation, dump order, large BLOB/text, NUL, int64, cyclic FKs, schema,
sequences and corruption. They join `test:release:unit`; CI never calls live D1.
Final local regression result: 186/186 root unit tests and targeted lint passed.
Production/staging anonymous HTTPS returned their login redirects; public info
returned 200. These smoke checks do not substitute for full account/PWA acceptance.

## Remaining Release Work

This closes the current SINGLE-D1 restore proof only. Live migration still needs
a reviewed plan, fresh pre-migration snapshot and separate SQL approval. Full
production rollback/RPO/RTO, scheduled backups, off-device key recovery,
coordinated multi-D1 recovery and deletion-ledger replay are NOT complete.
Repeat affected checks when schema/group/auth/erasure architecture changes.
Never copy this real backup into shared staging or a Worker-exposed database.
