# Shared Group Storage

October 20, 2026. Requested replacement of the GLOBAL three-group bottleneck.
This document describes implementation, not a completed production migration.

## Decision

New groups share canonical D1 tables under an explicit `group_id`. Existing
default and dedicated groups keep their databases, IDs, members, roles, media,
account links, invitations and appearance. No staging data is imported. No DB
is deleted or reset. No paid plan or additional remote test resource is needed.

One database per group provided physical isolation and independent restore,
but made self-service creation dependent on a finite preallocated pool.
Shared tables remove that global group-count limit, not storage/query/CPU limits.
An account's existing three-created-group abuse limit is separate from the
number of groups across all users; invitation membership is capped at twenty.

## Isolation Contract

- `shared_group_storage` explicitly identifies shared groups. The registry's
  unique `binding_name` is a routing key, NOT an actual Cloudflare binding for
  these groups. Only the exact derived `SHARED_...` key is accepted.
- Request identity, active membership, cookie/header agreement and local role
  remain mandatory. Group ID never comes from a raw user-supplied DB name.
- Domain reads use scoped CTEs for every joined domain table. Writes explicitly
  target shared tables with a tenant predicate; insert/conflict keys include it.
  Composite foreign keys prevent cross-group record references in the database.
- Canonical account members and shared group members are separate. A role in one
  group cannot grant privileges in another. Raw `database()` is rejected inside
  a shared-group request to prevent an accidentally unscoped legacy query.
- Medialinks, calendar, votes, trash, guests and account erasure use the same
  scoped layer. Private data is not added to PWA caches.

## Rollout And Recovery

1. Complete isolated SQLite AND workerd/API tests, legacy/four-theme regression.
2. Read current production registry/schema/claims without assuming pools remain
   empty: users may have created a dedicated group after the previous snapshot.
3. Meet the standard release gate, or use the separately recorded October20
   explicit one-time shared-update decision. The first-launch exception is consumed.
4. Take a fresh encrypted production backup. Apply ONLY additive `0015` as an
   atomic batch, verify every pre-existing row/schema/sequence unchanged, then
   deploy the tested revision with `SHARED_GROUPS_ENABLED=true`.
5. Never reapply `0008`-`0014`, reuse empty pools as migration targets, or delete
   an occupied DB. The legacy creation route remains available when flag is off.
6. A pre-change binary cannot read shared groups. After the first shared group
   exists, rollback must keep the shared-aware reader and disable creation with
   `GROUP_CREATION_DISABLED=true` while retaining `SHARED_GROUPS_ENABLED=true`;
   do not restore an older backup over newer users/content.

No zero-risk promise: general multi-tenant SQL changes require negative security
tests and controlled deployment. Physical data isolation becomes application
isolation with database foreign-key enforcement. Storage still needs monitoring.

The post-launch rollout has its own entry point and journal, independent of the
consumed first-launch exception:

```bash
corepack pnpm web:groups:deploy --confirm=koru-shared-production --suite=outputs/release-tests/ID/suite-report.json --evidence=.sites-runtime/web-release-evidence.json
```

It enforces the STANDARD gate before authentication/writes by default; keeps all existing
bindings (occupied or empty); stops new requests, drains, exports an encrypted
fresh backup, rehearses only 0015 offline, compares every old typed value/media/
sequence, applies atomic DDL, verifies the exact result and opens shared mode.
It never adds DBs, changes Secrets, replays the first launch, imports staging,
creates a provider account or sends test mail. Failure leaves an explicit
private phase journal; operator inspection/fix-forward is required, not a blind
retry or automatic rollback. The existing manual evidence is STILL pending;
do not use the first-launch decision again to force this update through.

Mustafa subsequently explicitly accepted those stated risks for THIS update.
The optional `--decision=private-path` supports only the separately tested
`operator-accepted-shared-group-update` policy, pinned to a clean pushed revision,
the exact0015 digest, unchanged dependencies and the reviewed source-file scope.
All13 manual criteria remain pending. A fresh backup and data checks are NOT waived.

References: [D1 limits](https://developers.cloudflare.com/d1/platform/limits/),
[atomic D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/),
[SQLite CTEs](https://www.sqlite.org/lang_with.html),
[composite foreign keys](https://www.sqlite.org/foreignkeys.html).
