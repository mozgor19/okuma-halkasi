import { FIREBASE_MANAGED_PASSWORD, FIREBASE_PROJECT } from "@/lib/firebase-auth-policy";

type Provider = { erase(uid: string): Promise<void> };
type Target = { uid: string | null; project: string };
const hexDigest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, "0")).join("");

export function firebaseErasureCoordinator(db: D1Database, provider?: Provider, requireProvider = false) {
  let prepared: { accountId: number; requestId: string; fingerprint: string; uids: string[] } | undefined;
  async function targets(accountId: number) {
    const account = await db.prepare("SELECT password_hash AS hash,(SELECT project_id FROM firebase_environment WHERE singleton=1) AS project FROM member_accounts WHERE member_id=?")
      .bind(accountId).first<{ hash: string; project: string }>();
    if (account?.project !== FIREBASE_PROJECT) throw Error("ERASURE_PROVIDER_ENVIRONMENT_MISMATCH");
    const references = await db.prepare(`SELECT 'link' AS kind,firebase_uid AS uid,project_id AS project FROM firebase_links WHERE member_id=?
      UNION ALL SELECT 'registration' AS kind,firebase_uid AS uid,project_id AS project FROM firebase_registrations
      WHERE member_id=? OR claim_member_id=? OR username=(SELECT username FROM member_accounts WHERE member_id=?)
        OR email=(SELECT email FROM account_profiles WHERE member_id=?)
      UNION SELECT 'session' AS kind,firebase_uid AS uid,project_id AS project FROM firebase_sessions WHERE member_id=?`)
      .bind(accountId, accountId, accountId, accountId, accountId, accountId).all<Target & { kind: string }>();
    const all = references.results;
    if ((account.hash === FIREBASE_MANAGED_PASSWORD && all.filter((row) => row.kind === "link").length !== 1)
      || all.some((row) => row.project !== FIREBASE_PROJECT || !row.uid || !/^[A-Za-z0-9_-]{1,128}$/.test(row.uid))) throw Error("ERASURE_PROVIDER_IDENTITY_REVIEW_REQUIRED");
    const uids = [...new Set(all.map((row) => row.uid!))].sort();
    if (uids.length > 4) throw Error("ERASURE_PROVIDER_IDENTITY_REVIEW_REQUIRED");
    if (uids.length) {
      const placeholders = uids.map(() => "?").join(",");
      const other = await db.prepare(`SELECT 1 FROM firebase_links WHERE project_id=? AND firebase_uid IN (${placeholders}) AND member_id<>?
        UNION ALL SELECT 1 FROM firebase_registrations WHERE project_id=? AND firebase_uid IN (${placeholders})
          AND (member_id IS NOT NULL AND member_id<>? OR claim_member_id IS NOT NULL AND claim_member_id<>?) LIMIT 1`)
        .bind(FIREBASE_PROJECT, ...uids, accountId, FIREBASE_PROJECT, ...uids, accountId, accountId).first();
      if (other) throw Error("ERASURE_PROVIDER_IDENTITY_REVIEW_REQUIRED");
    }
    return { uids, fingerprint: await hexDigest(JSON.stringify([FIREBASE_PROJECT, accountId, uids])) };
  }
  async function inspect(accountId: number) {
    const current = await targets(accountId);
    if (requireProvider && current.uids.length && !provider) throw Error("ERASURE_PROVIDER_AUTH_REQUIRED");
    // Fail before freezing if the checkpoint migration is absent.
    await db.prepare("SELECT 1 FROM account_erasure_provider_checkpoints LIMIT 1").first();
    return { fingerprint: current.fingerprint, count: current.uids.length };
  }
  async function erase(accountId: number, requestId: string, fingerprint: string) {
    const current = await targets(accountId);
    if (current.fingerprint !== fingerprint) throw Error("ERASURE_PROVIDER_PLAN_CHANGED");
    const frozen = await db.prepare("SELECT 1 FROM account_erasure_jobs WHERE request_id=? AND account_member_id=? AND frozen_at IS NOT NULL AND lease_token IS NOT NULL AND completed_at IS NULL").bind(requestId, accountId).first();
    if (!frozen) throw Error("ERASURE_PROVIDER_FREEZE_REQUIRED");
    if (current.uids.length && !provider) throw Error("ERASURE_PROVIDER_AUTH_REQUIRED");
    const freeze = freezeStatements(accountId);
    const digests = await Promise.all(current.uids.map((uid) => hexDigest(JSON.stringify([FIREBASE_PROJECT, uid]))));
    await db.batch([...freeze, ...digests.map((digest) => db.prepare("INSERT INTO account_erasure_provider_checkpoints(request_id,project_id,uid_digest) VALUES(?,?,?) ON CONFLICT DO NOTHING").bind(requestId, FIREBASE_PROJECT, digest))]);
    const checkpoints = await db.prepare("SELECT uid_digest,deleted_at FROM account_erasure_provider_checkpoints WHERE request_id=? AND project_id=?").bind(requestId, FIREBASE_PROJECT).all<{ uid_digest: string; deleted_at: number | null }>();
    if (checkpoints.results.length !== digests.length || checkpoints.results.some((row) => !digests.includes(row.uid_digest))) throw Error("ERASURE_PROVIDER_CHECKPOINT_MISSING");
    const pending = checkpoints.results.filter((row) => row.deleted_at === null);
    if (pending.length) {
      const digest = pending[0].uid_digest, uid = current.uids[digests.indexOf(digest)];
      await provider!.erase(uid);
      await db.prepare("UPDATE account_erasure_provider_checkpoints SET deleted_at=? WHERE request_id=? AND project_id=? AND uid_digest=? AND deleted_at IS NULL").bind(Date.now(), requestId, FIREBASE_PROJECT, digest).run();
      if (pending.length > 1) return false;
    }
    prepared = { accountId, requestId, fingerprint, uids: current.uids };
    return true;
  }
  function freezeStatements(accountId: number) {
    return [
      db.prepare("UPDATE firebase_links SET mutation_pending=1,mutation_kind='erasure',mutation_started_at=? WHERE member_id=?").bind(Date.now(), accountId),
      db.prepare("UPDATE firebase_sessions SET revoked_at=COALESCE(revoked_at,?),sealed_credentials='' WHERE member_id=?").bind(Date.now(), accountId),
    ];
  }
  async function cleanup(accountId: number, requestId: string, fingerprint: string) {
    // Only erase() in this execution can prepare cleanup. Identity rows are
    // untouched by domain purges, and writers must remain independently stopped.
    const current = prepared;
    if (!current || current.accountId !== accountId || current.requestId !== requestId || current.fingerprint !== fingerprint) throw Error("ERASURE_PROVIDER_PLAN_CHANGED");
    const checkpoints = await db.prepare("SELECT uid_digest,deleted_at FROM account_erasure_provider_checkpoints WHERE request_id=? AND project_id=?").bind(requestId, FIREBASE_PROJECT).all<{ uid_digest: string; deleted_at: number | null }>();
    const expected = await Promise.all(current.uids.map((uid) => hexDigest(JSON.stringify([FIREBASE_PROJECT, uid]))));
    if (checkpoints.results.length !== expected.length || checkpoints.results.some((row) => row.deleted_at === null || !expected.includes(row.uid_digest))) throw Error("ERASURE_PROVIDER_DELETE_UNCONFIRMED");
    return [
      db.prepare("DELETE FROM firebase_sessions WHERE member_id=?").bind(accountId),
      db.prepare(`DELETE FROM firebase_registrations WHERE member_id=? OR claim_member_id=? OR username=(SELECT username FROM member_accounts WHERE member_id=?)
        OR email=(SELECT email FROM account_profiles WHERE member_id=?)`).bind(accountId, accountId, accountId, accountId),
      db.prepare("DELETE FROM firebase_links WHERE member_id=?").bind(accountId),
    ];
  }
  return { inspect, erase, cleanup, freeze: freezeStatements };
}
