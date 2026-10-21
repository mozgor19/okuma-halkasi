import { env } from "cloudflare:workers";
import { after } from "next/server";
import { domainDatabase, identityDatabase, readingGroupContext, runWithReadingGroup } from "@/db/database";
import { meetingDetailsReady, type MeetingChange } from "@/db/meeting-details";
import { ReadingGroupError } from "@/lib/groups";
import { MeetingMailDeferred, meetingChangeMail, meetingMailConfiguration, sendMeetingMailBatch, type MeetingMailChange } from "@/lib/meeting-mail";
import { tokenHash } from "@/lib/onboarding-policy";

const local = () => env.SELF_SERVICE_LOCAL === "true";
export async function meetingMailReady() {
  const result = await identityDatabase().prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('meeting_mail_preferences','meeting_mail_deliveries')").first<{ n: number }>();
  return result?.n === 2 && await meetingDetailsReady();
}
export async function meetingMailPreference() {
  if (!await meetingMailReady()) return { available: false, enabled: false, deliveryReady: false };
  const context = readingGroupContext();
  if (!context) return { available: false, enabled: false, deliveryReady: false };
  const row = await identityDatabase().prepare("SELECT enabled FROM meeting_mail_preferences WHERE account_member_id=? AND group_id=?")
    .bind(context.accountMemberId, context.group.id).first<{ enabled: number }>();
  const profile = await identityDatabase().prepare("SELECT verified_at FROM account_profiles WHERE member_id=?").bind(context.accountMemberId).first<{ verified_at: number }>();
  return { available: true, enabled: row?.enabled === 1, verified: !!profile?.verified_at, deliveryReady: local() || !!meetingMailConfiguration() };
}
export async function saveMeetingMailPreference(enabled: unknown) {
  const context = readingGroupContext();
  if (!context || typeof enabled !== "boolean" || !await meetingMailReady()) throw new ReadingGroupError("MAIL_UNAVAILABLE", 503, "E-posta tercihleri henüz bu ortamda açılamıyor.");
  const current = await meetingMailPreference();
  if (enabled && !current.verified) throw new ReadingGroupError("EMAIL_NOT_VERIFIED", 403, "Önce hesabının e-posta adresini doğrula.");
  await identityDatabase().prepare(`INSERT INTO meeting_mail_preferences(account_member_id,group_id,enabled,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(account_member_id,group_id) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at`)
    .bind(context.accountMemberId, context.group.id, enabled ? 1 : 0, Date.now()).run();
  if (!enabled) await identityDatabase().prepare("UPDATE meeting_mail_deliveries SET status='skipped',updated_at=? WHERE account_member_id=? AND group_id=? AND status='pending'")
    .bind(Date.now(), context.accountMemberId, context.group.id).run();
  return meetingMailPreference();
}

export async function meetingMailQueue() {
  const context = readingGroupContext();
  if (!context || !await meetingMailReady()) return null;
  const rows = await identityDatabase().prepare("SELECT status,count(*) AS count FROM meeting_mail_deliveries WHERE group_id=? GROUP BY status")
    .bind(context.group.id).all<{ status: string; count: number }>();
  return Object.fromEntries(rows.results.map((row) => [row.status, row.count]));
}

export async function dispatchMeetingChanges(eventId?: string) {
  const context = readingGroupContext();
  if (!context || !await meetingMailReady() || (!local() && !meetingMailConfiguration())) return;
  const db = identityDatabase(), groupId = context.group.id, now = Date.now(), deadline = now + 20_000;
  // A crashed request may have reached the provider. Never retry that lease.
  await db.prepare("UPDATE meeting_mail_deliveries SET status='uncertain',updated_at=? WHERE group_id=? AND status='sending' AND claimed_at<?")
    .bind(now, groupId, now - 5 * 60_000).run();
  await db.prepare("UPDATE meeting_mail_deliveries SET status='skipped',updated_at=? WHERE group_id=? AND status='pending' AND created_at<?")
    .bind(now, groupId, now - 20 * 3600_000).run();
  await domainDatabase().update("meeting_change_events", "mail_completed_at=?", "mail_completed_at IS NULL AND created_at<=?")
    .bind(now, now - 20 * 3600_000).run();
  await db.prepare("DELETE FROM meeting_mail_deliveries WHERE group_id=? AND updated_at<? AND status NOT IN ('pending','sending')")
    .bind(groupId, now - 30 * 86400_000).run();
  await domainDatabase().delete("meeting_change_events", "created_at<? AND mail_completed_at IS NOT NULL")
    .bind(now - 30 * 86400_000).run();
  const events = await domainDatabase().read(`SELECT e.id,e.meeting_id AS meetingId,e.revision,e.payload,e.created_at AS createdAt
    FROM meeting_change_events e JOIN meetings m ON m.id=e.meeting_id WHERE m.deleted_at IS NULL AND e.mail_completed_at IS NULL AND e.created_at>? ${eventId ? "AND e.id=?" : ""}
    ORDER BY e.created_at LIMIT 1`, ["meeting_change_events"]).bind(now - 20 * 3600_000, ...(eventId ? [eventId] : [])).all<MeetingChange>();
  for (const event of events.results.flatMap((item) => [item, item, item])) {
    if (Date.now() > deadline - 9000) break;
    const book = await domainDatabase().read("SELECT b.title FROM meetings m JOIN books b ON b.id=m.book_id WHERE m.id=? AND m.deleted_at IS NULL").bind(event.meetingId).first<{ title: string }>();
    if (!book) continue;
    await db.prepare(`INSERT OR IGNORE INTO meeting_mail_deliveries(group_id,event_id,account_member_id,status,created_at,updated_at)
      SELECT ?,?,m.account_member_id,'pending',?,? FROM reading_group_memberships m
      JOIN meeting_mail_preferences p ON p.account_member_id=m.account_member_id AND p.group_id=m.group_id
      JOIN account_profiles a ON a.member_id=m.account_member_id JOIN member_accounts c ON c.member_id=m.account_member_id
      WHERE m.group_id=? AND m.is_active=1 AND p.enabled=1 AND p.updated_at<=? AND a.verified_at>0 AND c.password_hash<>''
      AND NOT EXISTS(SELECT 1 FROM account_erasure_jobs j WHERE j.account_member_id=m.account_member_id)`)
      .bind(groupId, event.id, now, now, groupId, event.createdAt).run();
    await db.prepare(`UPDATE meeting_mail_deliveries SET status='skipped',updated_at=? WHERE group_id=? AND event_id=? AND status='pending'
      AND NOT EXISTS(SELECT 1 FROM reading_group_memberships m JOIN meeting_mail_preferences p ON p.account_member_id=m.account_member_id AND p.group_id=m.group_id
      WHERE m.group_id=meeting_mail_deliveries.group_id AND m.account_member_id=meeting_mail_deliveries.account_member_id AND m.is_active=1 AND p.enabled=1 AND p.updated_at<=?)`)
      .bind(now, groupId, event.id, event.createdAt).run();
    const lease = crypto.randomUUID();
    const claimed = await db.prepare(`UPDATE meeting_mail_deliveries SET status='sending',claimed_at=?,updated_at=?,lease_token=?
      WHERE group_id=? AND event_id=? AND status='pending' AND coalesce(retry_after,0)<=? AND account_member_id IN (
        SELECT d.account_member_id FROM meeting_mail_deliveries d
        JOIN reading_group_memberships m ON m.account_member_id=d.account_member_id AND m.group_id=d.group_id
        JOIN meeting_mail_preferences p ON p.account_member_id=d.account_member_id AND p.group_id=d.group_id
        WHERE d.group_id=? AND d.event_id=? AND d.status='pending' AND m.is_active=1 AND p.enabled=1 AND p.updated_at<=?
        ORDER BY d.account_member_id LIMIT 90) RETURNING account_member_id AS accountId`)
      .bind(now, now, lease, groupId, event.id, now, groupId, event.id, event.createdAt).all<{ accountId: number }>();
    if (!claimed.results.length) {
      const pending = await db.prepare("SELECT count(*) AS n FROM meeting_mail_deliveries WHERE group_id=? AND event_id=? AND status IN ('pending','sending')").bind(groupId, event.id).first<{ n: number }>();
      if (!pending?.n) await domainDatabase().update("meeting_change_events", "mail_completed_at=?", "id=?").bind(Date.now(), event.id).run();
      continue;
    }
    const recipients = await db.prepare(`SELECT d.account_member_id AS accountId,a.email FROM meeting_mail_deliveries d
      JOIN account_profiles a ON a.member_id=d.account_member_id JOIN member_accounts c ON c.member_id=d.account_member_id
      JOIN reading_group_memberships m ON m.account_member_id=d.account_member_id AND m.group_id=d.group_id
      JOIN meeting_mail_preferences p ON p.account_member_id=d.account_member_id AND p.group_id=d.group_id
      WHERE d.group_id=? AND d.event_id=? AND d.status='sending' AND d.lease_token=? AND m.is_active=1 AND p.enabled=1 AND a.verified_at>0
      AND p.updated_at<=? AND c.password_hash<>'' AND NOT EXISTS(SELECT 1 FROM account_erasure_jobs j WHERE j.account_member_id=d.account_member_id) ORDER BY d.account_member_id`)
      .bind(groupId, event.id, lease, event.createdAt).all<{ accountId: number; email: string }>();
    const origin = local() ? "https://koru.example" : meetingMailConfiguration()!.origin;
    const content = meetingChangeMail({ origin, group: context.group, meetingId: event.meetingId, title: book.title, change: JSON.parse(event.payload) as MeetingMailChange });
    // Each provider request contains independent one-recipient messages, never a To/CC roster.
    for (let offset = 0; offset < recipients.results.length; offset += 90) {
      const batch = recipients.results.slice(offset, offset + 90), ids = batch.map((row) => row.accountId);
      try {
        if (local()) await db.batch(batch.map((row) => db.prepare("INSERT INTO development_mail(id,recipient,subject,body,expires_at) VALUES(?,?,?,?,?)")
          .bind(crypto.randomUUID(), row.email, content.subject, content.text, Date.now() + 30 * 60_000)));
        else await sendMeetingMailBatch(batch.map((row) => ({ ...content, recipient: row.email })), "meeting-change-" + await tokenHash(groupId + "/" + event.id + "/" + ids.join(",")));
        await db.prepare(`UPDATE meeting_mail_deliveries SET status='accepted',updated_at=? WHERE group_id=? AND event_id=? AND status='sending' AND lease_token=? AND account_member_id IN (${ids.map(() => "?").join(",")})`)
          .bind(Date.now(), groupId, event.id, lease, ...ids).run();
      } catch (error) {
        const deferred = error instanceof MeetingMailDeferred;
        await db.prepare(`UPDATE meeting_mail_deliveries SET status=?,retry_after=?,updated_at=? WHERE group_id=? AND event_id=? AND status='sending' AND lease_token=? AND account_member_id IN (${ids.map(() => "?").join(",")})`)
          .bind(deferred ? "pending" : "uncertain", deferred ? error.retryAfter : null, Date.now(), groupId, event.id, lease, ...ids).run();
        if (!deferred) console.error("Meeting mail batch requires delivery review; private details withheld");
      }
    }
    await db.prepare("UPDATE meeting_mail_deliveries SET status='skipped',updated_at=? WHERE group_id=? AND event_id=? AND status='sending' AND lease_token=?")
      .bind(Date.now(), groupId, event.id, lease).run();
  }
}

export function deferMeetingChanges(eventId?: string) {
  const context = readingGroupContext();
  if (!context) return;
  after(async () => { try { await runWithReadingGroup(context, () => dispatchMeetingChanges(eventId)); } catch { console.error("Meeting mail processing failed; private details withheld"); } });
}
