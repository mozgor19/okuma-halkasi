type BindingMap = Readonly<Record<string, D1Database>>;
type Counts = Record<string, number>;
type GroupStep = {
  groupId: string; binding: string; memberId: number; counts: Counts;
  successorAccountId: number | null; successorMemberId: number | null;
};
type ErasurePlan = {
  version: 1; requestId: string; accountId: number; steps: GroupStep[];
  blockers: string[]; confirmation: string;
};
type Job = { accountId: number; plan: string; digest: string; completedBindings: string; lease: string | null; completedAt: number | null };
type MemberRow = { id: number; role: string; avatar_media_key: string | null; face_reference_media_key: string | null };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const personalTables = ["attendance", "meeting_rsvps", "reviews", "favorite_books", "book_votes"];
function fail(code: string): never { throw new Error(code); }

async function digest(plan: ErasurePlan) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(plan)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Operator-only service. No public endpoint or remote CLI invokes this module.
// Execution requires independently stopped writers and a reviewed, exact dry-run plan.
export function accountErasureService(canonical: D1Database, bindings: BindingMap) {
  if (bindings.DB !== canonical || Object.values(bindings).some((db) => !db || typeof db.prepare !== "function" || typeof db.batch !== "function")
    || new Set(Object.values(bindings)).size !== Object.keys(bindings).length
    || Object.keys(bindings).some((name) => !/^[A-Z][A-Z0-9_]{0,63}$/.test(name))) fail("ERASURE_BINDING_MISMATCH");

  async function job(requestId: string) {
    return canonical.prepare(`SELECT account_member_id AS accountId, plan_json AS plan, plan_digest AS digest,
      completed_bindings AS completedBindings, lease_token AS lease, completed_at AS completedAt FROM account_erasure_jobs WHERE request_id = ?`)
      .bind(requestId).first<Job>();
  }
  async function journalPlan(requestId: string, stored: Job) {
    let plan: ErasurePlan, completed: unknown;
    try { plan = JSON.parse(stored.plan); completed = JSON.parse(stored.completedBindings); }
    catch { fail("ERASURE_JOURNAL_INVALID"); }
    const positive = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
    if (!plan || plan.version !== 1 || plan.requestId !== requestId || plan.accountId !== stored.accountId || !positive(plan.accountId)
      || plan.confirmation !== `ERASE:${requestId}:${plan.accountId}`
      || !Array.isArray(plan.blockers) || plan.blockers.some((value) => typeof value !== "string")
      || !Array.isArray(plan.steps) || !plan.steps.length
      || plan.steps.some((step) => !step || typeof step.groupId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(step.groupId)
        || !Object.hasOwn(bindings, step.binding) || !positive(step.memberId)
        || !((step.successorAccountId === null && step.successorMemberId === null)
          || (positive(step.successorAccountId) && positive(step.successorMemberId)))
        || !step.counts || typeof step.counts !== "object" || Array.isArray(step.counts)
        || [...personalTables, "photos", "media"].some((table) => !Number.isSafeInteger(step.counts[table]) || step.counts[table] < 0))
      || new Set(plan.steps.map((step) => step.binding)).size !== plan.steps.length
      || new Set(plan.steps.map((step) => step.groupId)).size !== plan.steps.length
      || !Array.isArray(completed) || completed.some((binding) => !plan.steps.some((step) => step.binding === binding))
      || new Set(completed).size !== completed.length || await digest(plan) !== stored.digest) fail("ERASURE_JOURNAL_INVALID");
    return plan;
  }
  async function registry() {
    const { results } = await canonical.prepare("SELECT id, binding_name AS binding FROM reading_groups ORDER BY binding_name").all<{ id: string; binding: string }>();
    if (results.some((row) => !Object.hasOwn(bindings, row.binding) || (row.id === "default") !== (row.binding === "DB"))
      || new Set(results.map((row) => row.binding)).size !== results.length) fail("ERASURE_REGISTRY_MISMATCH");
    for (const row of results) if (row.binding !== "DB") {
      const owner = await bindings[row.binding].prepare("SELECT group_id FROM group_database_ownership WHERE singleton = 1").first<{ group_id: string }>();
      if (owner?.group_id !== row.id) fail("ERASURE_GROUP_OWNERSHIP_MISMATCH");
    }
    return results;
  }
  async function ownedMedia(db: D1Database, member: MemberRow) {
    const { results } = await db.prepare("SELECT media_key FROM photos WHERE uploaded_by = ?").bind(member.id).all<{ media_key: string }>();
    return new Set([member.avatar_media_key, member.face_reference_media_key, ...results.map((row) => row.media_key)].filter((key): key is string => !!key));
  }
  async function sharedMedia(db: D1Database, member: MemberRow, keys: Set<string>) {
    if (!keys.size) return false;
    const others = await db.prepare("SELECT avatar_media_key, face_reference_media_key FROM members WHERE id <> ?").bind(member.id).all<{ avatar_media_key: string | null; face_reference_media_key: string | null }>();
    if (others.results.some((row) => (row.avatar_media_key && keys.has(row.avatar_media_key)) || (row.face_reference_media_key && keys.has(row.face_reference_media_key)))) return true;
    const photos = await db.prepare("SELECT media_key FROM photos WHERE uploaded_by <> ?").bind(member.id).all<{ media_key: string }>();
    if (photos.results.some((row) => keys.has(row.media_key))) return true;
    const books = await db.prepare("SELECT cover_url FROM books WHERE cover_url IS NOT NULL").all<{ cover_url: string }>();
    return books.results.some((row) => {
      try { const path = decodeURIComponent(new URL(row.cover_url, "https://local.invalid").pathname); return [...keys].some((key) => path === "/api/media/" + key); }
      catch { return true; }
    });
  }
  async function needsFirebaseCoordination(accountId: number) {
    const account = await canonical.prepare("SELECT password_hash AS passwordHash FROM member_accounts WHERE member_id=?").bind(accountId).first<{ passwordHash: string }>();
    if (account?.passwordHash === "managed:firebase-v1") return true;
    const tables = await canonical.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('firebase_links','firebase_sessions','firebase_registrations')").all<{ name: string }>();
    if (!tables.results.length) return false;
    if (tables.results.length !== 3) fail("ERASURE_IDENTITY_SCHEMA_INCOMPLETE");
    const linked = await canonical.prepare(`SELECT 1 FROM firebase_links WHERE member_id=?
      UNION ALL SELECT 1 FROM firebase_sessions WHERE member_id=?
      UNION ALL SELECT 1 FROM firebase_registrations WHERE member_id=? OR claim_member_id=?
        OR username=(SELECT username FROM member_accounts WHERE member_id=?)
        OR email=(SELECT email FROM account_profiles WHERE member_id=?) LIMIT 1`)
      .bind(accountId, accountId, accountId, accountId, accountId, accountId).first();
    return !!linked;
  }

  async function inspect(requestId: string, transfers: Readonly<Record<string, number>> = {}) {
    if (!uuid.test(requestId)) fail("ERASURE_INVALID_REQUEST");
    const existing = await job(requestId);
    if (existing) return { plan: await journalPlan(requestId, existing), digest: existing.digest, completed: existing.completedAt !== null };
    const request = await canonical.prepare("SELECT member_id AS accountId, status FROM account_deletion_requests WHERE id = ?").bind(requestId).first<{ accountId: number; status: string }>();
    if (!request || !["requested", "processing"].includes(request.status)) fail("ERASURE_REQUEST_NOT_ACTIVE");
    const accountId = request!.accountId;
    if (!await canonical.prepare("SELECT member_id FROM member_accounts WHERE member_id = ?").bind(accountId).first()) fail("ERASURE_ACCOUNT_MISSING");
    const groups = await registry();
    if (Object.keys(transfers).some((groupId) => !groups.some((row) => row.id === groupId))) fail("ERASURE_INVALID_SUCCESSOR");
    const steps: GroupStep[] = [], blockers: string[] = [];
    if (await needsFirebaseCoordination(accountId)) blockers.push("FIREBASE_ERASURE_COORDINATION_REQUIRED");
    for (const binding of Object.keys(bindings).sort()) {
      const db = bindings[binding];
      const group = groups.find((row) => row.binding === binding);
      const link = binding === "DB" ? { memberId: accountId } : await db.prepare("SELECT member_id AS memberId FROM group_account_links WHERE account_member_id = ?").bind(accountId).first<{ memberId: number }>();
      const membership = group ? await canonical.prepare("SELECT member_id AS memberId FROM reading_group_memberships WHERE account_member_id = ? AND group_id = ?").bind(accountId, group.id).first<{ memberId: number }>() : null;
      if (!link && !membership) continue;
      if (!group || (membership && link && membership.memberId !== link.memberId) || (binding !== "DB" && !link)) fail("ERASURE_MEMBER_MAPPING_MISMATCH");
      const memberId = link!.memberId;
      const member = await db.prepare("SELECT id, role, avatar_media_key, face_reference_media_key FROM members WHERE id = ?").bind(memberId).first<MemberRow>();
      if (!member) fail("ERASURE_MEMBER_MISSING");
      const counts: Counts = {};
      for (const table of personalTables) counts[table] = (await db.prepare(`SELECT count(*) AS n FROM ${table} WHERE member_id = ?`).bind(memberId).first<{ n: number }>())!.n;
      counts.photos = (await db.prepare("SELECT count(*) AS n FROM photos WHERE uploaded_by = ?").bind(memberId).first<{ n: number }>())!.n;
      const keys = await ownedMedia(db, member!);
      counts.media = keys.size;
      if (await sharedMedia(db, member!, keys)) blockers.push("SHARED_MEDIA_REVIEW:" + group!.id);
      const owner = await canonical.prepare("SELECT owner_id FROM group_provisioning WHERE group_id = ?").bind(group!.id).first<{ owner_id: number }>();
      const owners = await db.prepare("SELECT id, role FROM members WHERE id <> ? AND is_guest = 0 AND role IN ('admin', 'super_admin') ORDER BY id").bind(memberId).all<{ id: number; role: string }>();
      const active = await canonical.prepare("SELECT account_member_id AS accountId, member_id AS memberId FROM reading_group_memberships WHERE group_id = ? AND is_active = 1 AND account_member_id <> ?").bind(group!.id, accountId).all<{ accountId: number; memberId: number }>();
      const eligible = owners.results.flatMap((other) => active.results.filter((row) => row.memberId === other.id).map((row) => ({ ...row, role: other.role })));
      const transferNeeded = owner?.owner_id === accountId || (member!.role === "super_admin" && !eligible.some((row) => row.role === "super_admin"));
      const chosen = transfers[group!.id];
      const successor = chosen === undefined ? null : eligible.find((row) => row.accountId === chosen);
      if (chosen !== undefined && !successor) fail("ERASURE_INVALID_SUCCESSOR");
      if (transferNeeded && !successor) blockers.push("OWNERSHIP_TRANSFER_REQUIRED:" + group!.id);
      if (successor && (!await canonical.prepare("SELECT member_id FROM member_accounts WHERE member_id = ?").bind(successor.accountId).first()
        || await canonical.prepare("SELECT 1 FROM account_erasure_jobs WHERE account_member_id = ?").bind(successor.accountId).first())) fail("ERASURE_SUCCESSOR_UNAVAILABLE");
      steps.push({ groupId: group!.id, binding, memberId, counts, successorAccountId: successor?.accountId ?? null, successorMemberId: successor?.memberId ?? null });
    }
    const plan: ErasurePlan = { version: 1, requestId, accountId, steps, blockers, confirmation: `ERASE:${requestId}:${accountId}` };
    return { plan, digest: await digest(plan), completed: false };
  }

  async function execute(requestId: string, approval: {
    expectedDigest: string; confirmation: string; writersStopped: boolean; contentReviewComplete: boolean;
    transfers?: Readonly<Record<string, number>>;
  }) {
    if (approval.writersStopped !== true || approval.contentReviewComplete !== true) fail("ERASURE_OPERATOR_REVIEW_REQUIRED");
    const inspected = await inspect(requestId, approval.transfers);
    if (inspected.digest !== approval.expectedDigest || inspected.plan.confirmation !== approval.confirmation) fail("ERASURE_PLAN_CHANGED");
    if (inspected.plan.blockers.length) fail("ERASURE_PLAN_BLOCKED");
    if (inspected.completed) return { completed: true, alreadyCompleted: true };
    const plan = inspected.plan;
    // Recheck persisted plans too: a claim may have appeared after inspection.
    // Never erase domain data before provider deletion is durably coordinated.
    if (await needsFirebaseCoordination(plan.accountId)) fail("ERASURE_FIREBASE_COORDINATION_REQUIRED");
    const currentRegistry = await registry();
    if (plan.steps.some((step) => !currentRegistry.some((row) => row.id === step.groupId && row.binding === step.binding))) fail("ERASURE_REGISTRY_MISMATCH");
    const now = Date.now();
    try {
      await canonical.prepare(`INSERT INTO account_erasure_jobs(request_id, account_member_id, plan_json, plan_digest, created_at, updated_at)
        SELECT ?, member_id, ?, ?, ?, ? FROM account_deletion_requests WHERE id = ? AND member_id = ? AND status IN ('requested', 'processing')
        ON CONFLICT(request_id) DO NOTHING`).bind(requestId, JSON.stringify(plan), inspected.digest, now, now, requestId, plan.accountId).run();
    } catch (error) {
      if (error instanceof Error && /account_erasure_single_pending|account_erasure_single_runner/.test(error.message)) fail("ERASURE_BUSY");
      throw error;
    }
    const lease = crypto.randomUUID();
    let acquired = false;
    try {
      try {
        const lock = await canonical.prepare("UPDATE account_erasure_jobs SET lease_token = ?, updated_at = ? WHERE request_id = ? AND lease_token IS NULL AND completed_at IS NULL RETURNING request_id").bind(lease, now, requestId).first();
        if (!lock) fail("ERASURE_BUSY");
        acquired = true;
      } catch { fail("ERASURE_BUSY"); }
      const persisted = await job(requestId);
      if (!persisted || persisted.digest !== inspected.digest || persisted.lease !== lease) fail("ERASURE_PLAN_CHANGED");
      // Freezing and recovery-token revocation are one canonical transaction.
      await canonical.batch([
        canonical.prepare(`UPDATE member_accounts SET password_hash = '', password_salt = '', session_version = session_version + 1,
          locked_until = '9999-12-31T23:59:59.000Z' WHERE member_id = ? AND EXISTS
          (SELECT 1 FROM account_erasure_jobs WHERE request_id = ? AND lease_token = ? AND frozen_at IS NULL)`).bind(plan.accountId, requestId, lease),
        canonical.prepare("UPDATE account_deletion_requests SET status = 'processing', updated_at = ? WHERE id = ?").bind(now, requestId),
        canonical.prepare("DELETE FROM account_recovery_tokens WHERE member_id = ?").bind(plan.accountId),
        canonical.prepare("DELETE FROM account_email_verifications WHERE member_id = ?").bind(plan.accountId),
        canonical.prepare(`DELETE FROM pending_registrations WHERE member_id = ? OR username = (SELECT username FROM member_accounts WHERE member_id = ?)
          OR email = (SELECT email FROM account_profiles WHERE member_id = ?)`).bind(plan.accountId, plan.accountId, plan.accountId),
        canonical.prepare("UPDATE group_invitations SET revoked_at = COALESCE(revoked_at, ?) WHERE created_by = ?").bind(now, plan.accountId),
        canonical.prepare("UPDATE account_erasure_jobs SET frozen_at = COALESCE(frozen_at, ?), updated_at = ? WHERE request_id = ? AND lease_token = ?").bind(now, now, requestId, lease),
      ]);
      const completed: string[] = JSON.parse(persisted.completedBindings);
      for (const step of plan.steps) {
        if (completed.includes(step.binding)) continue;
        const db = bindings[step.binding];
        const member = await db.prepare("SELECT id, role, avatar_media_key, face_reference_media_key FROM members WHERE id = ?").bind(step.memberId).first<MemberRow>();
        if (!member) fail("ERASURE_MEMBER_MISSING");
        const keys = await ownedMedia(db, member!);
        if (await sharedMedia(db, member!, keys)) fail("ERASURE_SHARED_MEDIA_REVIEW");
        const statements = personalTables.map((table) => db.prepare(`DELETE FROM ${table} WHERE member_id = ?`).bind(step.memberId));
        if (step.successorMemberId !== null) statements.push(db.prepare("UPDATE members SET role = 'super_admin' WHERE id = ? AND role IN ('admin', 'super_admin') AND is_guest = 0").bind(step.successorMemberId));
        statements.push(
          db.prepare(`DELETE FROM media WHERE media_key IN (SELECT avatar_media_key FROM members WHERE id = ?
            UNION SELECT face_reference_media_key FROM members WHERE id = ? UNION SELECT media_key FROM photos WHERE uploaded_by = ?)`)
            .bind(step.memberId, step.memberId, step.memberId),
          db.prepare("DELETE FROM photos WHERE uploaded_by = ?").bind(step.memberId),
          db.prepare("UPDATE members SET name = 'Silinen hesap', role = 'member', color = '#808080', avatar_media_key = NULL, face_reference_media_key = NULL, face_recognition_consent = 0, is_guest = 1, guest_meeting_id = NULL WHERE id = ?").bind(step.memberId),
          db.prepare("DELETE FROM group_account_links WHERE account_member_id = ? AND member_id = ?").bind(plan.accountId, step.memberId),
        );
        await db.batch(statements);
        completed.push(step.binding);
        await canonical.prepare("UPDATE account_erasure_jobs SET completed_bindings = ?, updated_at = ? WHERE request_id = ? AND lease_token = ?").bind(JSON.stringify(completed), Date.now(), requestId, lease).run();
      }
      const final = [];
      for (const step of plan.steps) if (step.successorAccountId !== null) final.push(canonical.prepare("UPDATE group_provisioning SET owner_id = ? WHERE group_id = ? AND owner_id = ?").bind(step.successorAccountId, step.groupId, plan.accountId));
      final.push(
        canonical.prepare("DELETE FROM reading_group_memberships WHERE account_member_id = ?").bind(plan.accountId),
        canonical.prepare("DELETE FROM group_invitation_redemptions WHERE account_member_id = ?").bind(plan.accountId),
        canonical.prepare("DELETE FROM account_experience WHERE member_id = ?").bind(plan.accountId),
        canonical.prepare("DELETE FROM account_profiles WHERE member_id = ?").bind(plan.accountId),
        canonical.prepare("DELETE FROM account_deletion_requests WHERE id = ? AND member_id = ? AND status = 'processing'").bind(requestId, plan.accountId),
        canonical.prepare("DELETE FROM member_accounts WHERE member_id = ?").bind(plan.accountId),
        canonical.prepare("UPDATE account_erasure_jobs SET completed_at = ?, updated_at = ?, lease_token = NULL WHERE request_id = ? AND lease_token = ?").bind(Date.now(), Date.now(), requestId, lease),
      );
      await canonical.batch(final);
      return { completed: true, alreadyCompleted: false };
    } finally {
      if (acquired) await canonical.prepare("UPDATE account_erasure_jobs SET lease_token = NULL WHERE request_id = ? AND lease_token = ?").bind(requestId, lease).run();
    }
  }
  return { inspect, execute };
}
