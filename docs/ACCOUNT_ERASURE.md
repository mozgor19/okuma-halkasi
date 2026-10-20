# Account Erasure: Local Operator Prototype

October 19, 2026. This is NOT a public deletion endpoint or production-ready
operator tool. No remote user data was erased. Migration 0012 was applied only
to isolated synthetic local databases; it belongs ONLY to the canonical DB.

## Implemented

- `db/account-erasure.ts`: inspect/execute service with explicit DB bindings.
- Dry run discovers active/inactive memberships and partially provisioned
  `group_account_links`, validates group ownership and canonical/local IDs.
- Exact plan digest and confirmation, one unfinished job globally, one lease,
  no automatic stale-lease stealing. Persisted plans/checkpoints are validated.
- Credential/recovery freeze, per-group atomic deletion and canonical progress
  checkpoints. Retrying a committed group after a lost checkpoint is idempotent.
- Own reviews, votes, favorites, attendance, RSVP and own media BLOBs are removed;
  group membership/profile/credentials are removed at canonical finalization.
- Shared meetings/roadmap keep an anonymized FK member tombstone. Other people's
  records/media remain. Shared media references block, not silently cascade.
- Last-owner succession requires a reviewed explicit ACTIVE mapped administrator.
  The selected successor is promoted where necessary. No successor means blocked,
  not automatic destruction of a shared group.
- A retained canonical ledger denies password login, legacy bootstrap, old
  sessions and recovery even if deleted account rows are accidentally restored.
  No 0012 table preserves legacy behavior; unexpected DB errors fail closed.
- With candidate 0013, a Firebase-managed hash, link, session or pending claim
  blocks the D1-only service BEFORE any account freeze or group deletion.
  Partial identity schemas also fail closed; persisted plans are rechecked.
  Empty Firebase tables do not block unrelated legacy erasure. This guard is
  not provider deletion or completed Firebase erasure.

The ledger contains account/group IDs, row counts and timestamps. These remain
pseudonymous personal/security records, NOT anonymous data. No names, emails,
passwords, hashes or comment content belong in the plan/report.

## Mandatory Operator Preconditions

`writersStopped: true` and `contentReviewComplete: true` are attestations, NOT
automatically enforced maintenance mode. Before any real execution, independently
stop ALL HTTP/queue/scheduled/admin writers, inventory ALL approved bindings,
review free text and photographs uploaded by others, approve owner transfers,
and verify the exact inspected digest. No public endpoint accepts these flags.

The binding map must include all registered groups AND any allocated/orphan
databases. A library cannot discover a DB absent from its supplied configuration.
Retries rely on writers remaining stopped. They are NOT online race-proof.
A crashed lease requires human review, never a time-based automatic takeover.

## Still Blocking Production

1. Protected operator entry point/queue, audited operator identity, enforced
   maintenance/quiescence and provider-state coordination. No remote CLI exists.
2. Sole-owner/no-successor group closure policy/workflow. Current result is a
   clear blocker, not completed erasure. Shared content rights need human review.
3. Legal response/retention deadlines, export and out-of-band encrypted deletion
   journal. Full canonical restore can also restore an OLD ledger: retaining a
   ledger in the same DB alone cannot prevent resurrection after full restore.
4. Separate backup/restore drill including media, erasure replay BEFORE access
   reopens, rollback vs forward recovery and retention/access review.
5. Before the implemented Firebase branch is enabled, provider deletion/token revocation need their
   own durable checkpoints. Current service is D1-only and must not declare the
   whole account erased while a provider identity remains live.
6. Fixed-revision staging/production schema checks, operator-approved SQL and
   separate real-erasure approval. Do not infer these from local tests.

## Verification

`corepack pnpm test:release:unit` includes 16 focused erasure tests: exact
approval, last owner/shared media, wrong IDs/bindings, rollback inside a group
transaction, cross-DB failure, checkpoint loss, finalization failure, concurrent
pending job/lease rejection, corrupt journal and preserved-ledger restored-row
login/recovery rejection, Firebase identity/claim protection and resumed-plan
provider checks. One test runs the same service against genuine LOCAL
workerd D1 bindings and checks foreign keys/BLOB retention for other users.

These tests do not read production data, execute a real backup restore or prove
legal erasure of third-party free text/photos. Keep that scope visible in reports.
