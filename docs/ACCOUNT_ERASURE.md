# Account Erasure: Operator Workflow

## October 20 Extension

The earlier D1-only prototype below is historical. The current implementation
adds a separate Secret-authenticated operator endpoint and CLI, production-only
Firebase UID/project validation, durable provider checkpoints (canonical migration
0014), provider absence verification BEFORE domain deletion, and atomic identity
cleanup before account finalization. No real user was erased during development.

`corepack pnpm account:erase --queue` lists request IDs/status only.
`corepack pnpm account:erase --request=REQUEST_UUID` inspects; it never deletes.
Explicit owner transfers use `--transfers='{"group-id":ACCOUNT_ID}'`.
Execution additionally needs `--execute --digest=INSPECTED_SHA256
--confirmation=ERASE:REQUEST_UUID:ACCOUNT_ID
--ack=writers-drained-and-content-reviewed` on the same inspected request.
Do not use placeholder values or execute an unreviewed request.

The local private `.sites-runtime/koru-production/erasure-operator.key` must match
Worker Secret `ERASURE_OPERATOR_SECRET`. It is not a member/admin permission.
Queue/inspection are protected; execution also requires MAINTENANCE_MODE=true.
Independently stop/drain ALL HTTP, scheduled, queue and administrative writers,
review third-party free text/photos, and verify successor ownership. The flag
alone does not stop in-flight requests or unrelated administrative writes.

For Firebase identities, the CLI requires an explicitly authorized operator's
private Google user ADC at `~/.config/gcloud/application_default_credentials.json`,
with Identity Toolkit OAuth scope and firebaseauth.users.get/delete permissions
on **koru-951bf**. Cloud SDK is not currently installed locally; configure this
interactively when an actual reviewed deletion requires it. No service-account
key, metadata fallback or permanent Google Admin credential is installed in the
Worker/browser. The short-lived access token stays in request memory, never in
arguments, reports or the erasure ledger. Missing authorization stops execution.

One successful phase per request bounds D1 calls: freeze, each provider identity,
then each group and finalization. Only acknowledged progress is continued by the
CLI. Ambiguous provider failures are not blindly retried. Frozen jobs remain
blocked and resumable; no automatic stale-lease stealing. UID digests and retained
job IDs remain pseudonymous, NOT anonymous. Full old-backup restoration requires
independent deletion-journal review/replay before reopening; the same-DB ledger
alone cannot prevent resurrection from a backup older than the ledger.

Local coverage includes 17 D1 erasure tests, seven coordinator/operator tests,
and four signed-auth/operator workerd tests. All provider transport is synthetic;
no real Google identity/mail/deletion was exercised. The multi-group phase budget
test is not a claim of measured remote Free-runtime CPU or legal completeness.
Sole-owner groups without an eligible successor, shared media, unknown/orphan UID
and incomplete third-party content review remain explicit blockers.

Official references: [Admin delete](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/delete),
[operator ADC](https://docs.cloud.google.com/docs/authentication/provide-credentials-adc).

## Historical D1-Only Prototype

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
