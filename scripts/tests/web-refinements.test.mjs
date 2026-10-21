import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { sharedGroupFixture } from "../fixtures/shared-groups-test.mjs";
import { describeSnapshot, verifySnapshot } from "../d1-backup-policy.mjs";

function fixture() {
  const f = sharedGroupFixture();
  for (const file of ["0016_meeting_details", "0017_group_communication"]) f.sql.exec(readFileSync(new URL(`../../drizzle/${file}.sql`, import.meta.url), "utf8"));
  f.env.SELF_SERVICE_LOCAL = "true";
  delete f.env.AUTH_PROVIDER;
  async function context(accountId, group, fn) {
    const member = f.sql.prepare("SELECT member_id FROM reading_group_memberships WHERE account_member_id=? AND group_id=?").get(accountId, group.id);
    return f.load("db/database").runWithReadingGroup({ db: f.db, accountMemberId: accountId, memberId: member.member_id,
      group, ...(group.id !== "default" ? { sharedGroupId: group.id } : {}) }, fn);
  }
  const create = (id, group, patch = {}) => f.action(id, group.id, { action: "createMeeting", book: { title: "Synthetic Book", author: "Author" }, date: "2028-10-20T19:00", location: "Library", ...patch });
  return { ...f, context, meeting: create };
}

test("a delivered change notification neither repeats daily nor suppresses new/upcoming meeting reminders", () => {
  const f = fixture();
  try {
    const { nextDeviceNotification } = f.load("lib/notification-policy"), sent = new Set();
    const items = [{ id: "changed-event" }, { id: "new-7" }, { id: "upcoming-8" }];
    const choose = (day = "2026-10-21", group = "sample") => nextDeviceNotification(items, group, 1, day, (key) => sent.has(key));
    const first = choose(); assert.equal(first.notification.id, "changed-event"); sent.add(first.key);
    assert.equal(choose("2026-10-22").notification.id, "new-7");
    const second = choose(); sent.add(second.key); assert.equal(choose().notification.id, "upcoming-8");
    assert.equal(choose("2026-10-21", "other").notification.id, "changed-event");
  } finally { f.close(); }
});

test("communication migrations are additive and leave original typed content and credentials unchanged", async () => {
  const f = sharedGroupFixture();
  try {
    f.sql.exec("INSERT INTO books(title,author) VALUES('Old book','Old author');INSERT INTO media(media_key,content_type,data) VALUES('retained','image/png',X'010203')");
    const before = describeSnapshot(f.sql);
    for (const file of ["0016_meeting_details", "0017_group_communication"]) f.sql.exec(readFileSync(new URL(`../../drizzle/${file}.sql`, import.meta.url), "utf8"));
    const after = describeSnapshot(f.sql);
    await verifySnapshot({ ...before, schemaDigest: after.schemaDigest }, async (sql) => f.sql.prepare(sql).all());
    for (const row of before.schema) assert.deepEqual(after.schema.find((item) => item.name === row.name), row);
    assert.equal(after.tables.length - before.tables.length, 6);
    assert.deepEqual(f.sql.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { f.close(); }
});

test("meeting venue validates optional online links, rejects credential/script/control URLs and preserves physical validation", () => {
  const f = fixture();
  try {
    const { meetingVenue } = f.load("lib/meeting-details");
    assert.deepEqual(meetingVenue({ kind: "online" }), { kind: "online", location: "Çevrim içi", mapUrl: null, onlineUrl: null });
    assert.equal(meetingVenue({ kind: "online", onlineUrl: "https://meet.google.com/test" }).onlineUrl, "https://meet.google.com/test");
    assert.throws(() => meetingVenue({ kind: "in_person", location: "" }));
    for (const onlineUrl of ["javascript:alert(1)", "http://meet.example/test", "https://user:secret@meet.example/", "https://meet.example/\r\nBCC:x", "x".repeat(2049)]) {
      assert.throws(() => meetingVenue({ kind: "online", onlineUrl }));
    }
    assert.throws(() => meetingVenue({ kind: "hybrid", location: "Library" }));
    assert.equal(meetingVenue({ location: "Library" }).kind, "in_person");
  } finally { f.close(); }
});

test("online creation, continuation, physical/online edits and optimistic revisions work in both default and shared domains", async () => {
  const f = fixture();
  try {
    for (const group of [{ id: "default", name: "Default", scheme: "notebook", mode: "light" }, (await f.create(1)).group]) {
      const created = await f.meeting(1, group, { kind: "online", location: "", onlineUrl: "" });
      assert.equal(created.status, 200, JSON.stringify(created.body));
      const id = created.body.meetingId;
      let state = await f.state(1, group.id), meeting = state.body.meetings.find((item) => item.id === id);
      assert.equal(meeting.kind, "online"); assert.equal(meeting.onlineUrl, null); assert.equal(meeting.revision, 1);
      const payload = { action: "editMeeting", meetingId: id, date: "2028-10-21T20:00", kind: "in_person", location: "New library", revision: 1 };
      const updated = await f.action(1, group.id, payload); assert.equal(updated.status, 200, JSON.stringify(updated.body));
      const conflict = await f.action(1, group.id, { ...payload, location: "Stale library" }); assert.equal(conflict.status, 409);
      state = await f.state(1, group.id); meeting = state.body.meetings.find((item) => item.id === id);
      assert.equal(meeting.location, "New library"); assert.equal(meeting.kind, "in_person"); assert.equal(meeting.revision, 2);
      assert.equal(state.body.meetingChanges.length, 1);
      await f.action(1, group.id, { ...payload, revision: 2 });
      assert.equal((await f.state(1, group.id)).body.meetingChanges.length, 1, "No-op edit must not emit another event");
      const continuing = await f.meeting(1, group, { book: undefined, bookId: meeting.bookId, kind: "online", onlineUrl: "https://meet.example/session" });
      assert.equal(continuing.status, 200); assert.notEqual(continuing.body.meetingId, id);
    }
  } finally { f.close(); }
});

test("meeting details, change events, calendar links and preferences cannot cross group boundaries", async () => {
  const f = fixture();
  try {
    const a = (await f.create(1)).group, b = (await f.create(2)).group;
    const created = await f.meeting(1, a, { kind: "online", onlineUrl: "https://meet.example/private" });
    const foreign = await f.action(2, b.id, { action: "editMeeting", meetingId: created.body.meetingId, date: "2028-10-20T19:00", location: "Wrong", kind: "in_person" });
    assert.equal(foreign.status, 404);
    assert.throws(() => f.sql.prepare("INSERT INTO shared_meeting_details(group_id,meeting_id,kind,revision,updated_at) VALUES(?,?,'online',1,1)").run(b.id, created.body.meetingId));
    assert.equal((await f.state(2, b.id)).body.meetings.length, 0);
    assert.equal((await f.state(2, b.id)).body.meetingChanges.length, 0);
    const response = await f.load("app/api/groups/notifications/route").POST(await f.request(2, a.id, "/api/groups/notifications", "POST", { enabled: true }));
    assert.ok([403, 409].includes(response.status));
  } finally { f.close(); }
});

test("calendar keeps the previous event UID, increments sequence, includes online link and folds UTF-8 without injection", () => {
  const f = fixture();
  try {
    const { meetingCalendar } = f.load("lib/meeting-calendar");
    const base = { id: 7, date: "2028-10-20T19:00", location: "Library", note: "A\nB", readingScope: "1–30", revision: 0 };
    const args = { origin: "https://birkoru.com", group: { id: "sample", name: "Örnek Grup" }, title: "Öğüşİ".repeat(40) + "\r\nATTENDEE:attack", author: "Author" };
    const old = meetingCalendar({ ...args, meeting: base });
    const updated = meetingCalendar({ ...args, meeting: { ...base, kind: "online", onlineUrl: "https://meet.example/link", revision: 2, updatedAt: Date.now() } });
    assert.equal(old.match(/^UID:.*$/m)[0], updated.match(/^UID:.*$/m)[0]);
    assert.match(updated, /SEQUENCE:2\r\n/); assert.match(updated, /LAST-MODIFIED:/);
    assert.match(updated, /LOCATION:https:\/\/meet.example\/link/);
    assert.ok(!updated.includes("\r\nATTENDEE:"));
    assert.ok(updated.split("\r\n").every((line) => Buffer.byteLength(line) <= 75));
    assert.match(updated, /meeting=7&group=sample/);
  } finally { f.close(); }
});

test("opt-in is account/group specific; only verified active consent existing at the change receives one private local message", async () => {
  const f = fixture();
  try {
    const group = (await f.create(1)).group;
    const invite = await f.load("db/onboarding-groups").manageInvitations(await f.request(1, group.id, "/invite", "POST"), "create");
    await f.load("db/onboarding-groups").joinReadingGroup(2, invite.token);
    await f.context(1, group, () => f.load("db/meeting-mail").saveMeetingMailPreference(true));
    assert.equal((await f.context(2, group, () => f.load("db/meeting-mail").meetingMailPreference())).enabled, false);
    const created = await f.meeting(1, group, { kind: "online" });
    const changed = await f.action(1, group.id, { action: "editMeeting", meetingId: created.body.meetingId, date: "2028-10-21T19:00", kind: "online", onlineUrl: "https://meet.example/new", revision: 1 });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    await f.flush();
    let messages = f.sql.prepare("SELECT recipient,subject,body FROM development_mail").all();
    assert.equal(messages.length, 1); assert.equal(messages[0].recipient, "reader1@example.test");
    assert.ok(!messages[0].body.includes("reader2@example.test")); assert.match(messages[0].body, /Önceki bilgiler/); assert.match(messages[0].body, /api\/calendar/);
    await f.context(1, group, () => f.load("db/meeting-mail").dispatchMeetingChanges());
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM development_mail").get().n, 1);
    await f.context(2, group, () => f.load("db/meeting-mail").saveMeetingMailPreference(true));
    await f.context(1, group, () => f.load("db/meeting-mail").dispatchMeetingChanges());
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM development_mail").get().n, 1, "New consent cannot backfill a past change");
    await f.context(1, group, () => f.load("db/meeting-mail").saveMeetingMailPreference(false));
    await f.action(1, group.id, { action: "editMeeting", meetingId: created.body.meetingId, date: "2028-10-22T19:00", kind: "online", revision: 2 });
    f.sql.prepare("UPDATE reading_group_memberships SET is_active=0 WHERE account_member_id=2 AND group_id=?").run(group.id);
    await f.flush();
    messages = f.sql.prepare("SELECT recipient FROM development_mail").all(); assert.equal(messages.length, 1);
  } finally { f.close(); }
});

test("group hero upload is admin-only, scoped and resettable without deleting another referenced image", async () => {
  const f = fixture();
  try {
    const a = (await f.create(1)).group, b = (await f.create(2)).group;
    const bytes = readFileSync(new URL("../../public/brand/koru-192-v2.png", import.meta.url));
    const request = await f.request(1, a.id, "/api/upload", "POST"); const headers = new Headers(request.headers); headers.delete("Content-Type");
    const form = new FormData(); form.set("purpose", "groupHero"); form.set("file", new File([bytes], "group.png", { type: "image/png" }));
    const invite = await f.load("db/onboarding-groups").manageInvitations(await f.request(1, a.id, "/invite", "POST"), "create");
    await f.load("db/onboarding-groups").joinReadingGroup(2, invite.token);
    const memberRequest = await f.request(2, a.id, "/api/upload", "POST"); const memberHeaders = new Headers(memberRequest.headers); memberHeaders.delete("Content-Type");
    assert.equal((await f.load("app/api/upload/route").POST(new Request(memberRequest.url, { method: "POST", headers: memberHeaders, body: form }))).status, 403);
    assert.equal((await f.action(2, a.id, { action: "resetGroupHero" })).status, 403);
    const response = await f.load("app/api/upload/route").POST(new Request(request.url, { method: "POST", headers, body: form }));
    assert.equal(response.status, 200); const uploaded = await response.json();
    assert.equal((await f.state(1, a.id)).body.groupHeroUrl, "/api/media/" + uploaded.mediaKey);
    assert.equal((await f.state(2, b.id)).body.groupHeroUrl, null);
    await f.domain(a.id).insert("books", "title,author,cover_url", "?,?,?").bind("Cover", "Author", "/api/media/" + uploaded.mediaKey).run();
    assert.equal((await f.action(1, a.id, { action: "resetGroupHero" })).status, 200);
    assert.equal((await f.state(1, a.id)).body.groupHeroUrl, null);
    assert.ok(await f.domain(a.id).read("SELECT media_key FROM media WHERE media_key=?").bind(uploaded.mediaKey).first());
  } finally { f.close(); }
});

test("failed edits roll back metadata and no event/mail leaks; unverified consent and non-admin queue access are rejected", async () => {
  const f = fixture();
  try {
    const group = (await f.create(1)).group;
    const created = await f.meeting(1, group, { kind: "online" });
    f.hooks.failBatch = true;
    const failed = await f.action(1, group.id, { action: "editMeeting", meetingId: created.body.meetingId, date: "2028-10-22T19:00", kind: "online", revision: 1 });
    assert.equal(failed.status, 503); f.hooks.failBatch = false;
    const state = await f.state(1, group.id);
    assert.equal(state.body.meetings[0].revision, 1); assert.equal(state.body.meetings[0].date, "2028-10-20T19:00"); assert.deepEqual(state.body.meetingChanges, []);
    f.sql.prepare("UPDATE account_profiles SET verified_at=0 WHERE member_id=1").run();
    await assert.rejects(f.context(1, group, () => f.load("db/meeting-mail").saveMeetingMailPreference(true)), /doğrula/);
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM meeting_mail_preferences").get().n, 0);
    const invite = await f.load("db/onboarding-groups").manageInvitations(await f.request(1, group.id, "/invite", "POST"), "create");
    await f.load("db/onboarding-groups").joinReadingGroup(2, invite.token);
    const notifications = f.load("app/api/groups/notifications/route");
    assert.equal((await (await notifications.GET(await f.request(2, group.id, "/api/groups/notifications"))).json()).queue, undefined);
    assert.equal((await notifications.POST(await f.request(2, group.id, "/api/groups/notifications", "POST", { action: "retry" }))).status, 403);
    f.sql.prepare("UPDATE account_profiles SET verified_at=1 WHERE member_id=1").run();
    await f.context(1, group, () => f.load("db/meeting-mail").saveMeetingMailPreference(true));
    f.sql.prepare("DELETE FROM reading_group_memberships WHERE account_member_id=1 AND group_id=?").run(group.id);
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM meeting_mail_preferences").get().n, 0);
  } finally { f.close(); }
});

test("mail provider responses are validated, HTML escaped, stale leases reviewed and ambiguous batches never replayed", async () => {
  const f = fixture(), originalFetch = globalThis.fetch;
  try {
    const group = (await f.create(1)).group;
    await f.context(1, group, () => f.load("db/meeting-mail").saveMeetingMailPreference(true));
    const created = await f.meeting(1, group, { kind: "online" });
    await f.action(1, group.id, { action: "editMeeting", meetingId: created.body.meetingId, date: "2028-10-21T19:00", kind: "online", revision: 1 });
    f.env.SELF_SERVICE_LOCAL = "false"; f.env.MEETING_MAIL_ENABLED = "true"; f.env.MEETING_MAIL_FROM = "bildirim@birkoru.com"; f.env.MEETING_MAIL_API_KEY = "synthetic-not-real";
    let requests = 0;
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://api.resend.com/emails/batch"); requests++;
      const messages = JSON.parse(init.body); assert.equal(messages.length, 1); assert.deepEqual(messages[0].to, ["reader1@example.test"]);
      assert.ok(!messages[0].cc && !messages[0].bcc); assert.ok(init.headers["Idempotency-Key"]);
      return Response.json({ data: [] });
    };
    await f.flush();
    assert.equal(requests, 1); assert.equal(f.sql.prepare("SELECT status FROM meeting_mail_deliveries").get().status, "uncertain");
    await f.context(1, group, () => f.load("db/meeting-mail").dispatchMeetingChanges()); assert.equal(requests, 1);
    f.sql.prepare("UPDATE meeting_mail_deliveries SET status='sending',claimed_at=?").run(Date.now() - 600_000);
    await f.context(1, group, () => f.load("db/meeting-mail").dispatchMeetingChanges());
    assert.equal(f.sql.prepare("SELECT status FROM meeting_mail_deliveries").get().status, "uncertain"); assert.equal(requests, 1);
    const snapshot = { date: "2028-10-20T19:00", kind: "in_person", location: '<img src=x onerror="attack">', onlineUrl: null, mapUrl: null };
    const mail = f.load("lib/meeting-mail").meetingChangeMail({ origin: "https://birkoru.com", group: { id: group.id, name: "<script>attack</script>" }, meetingId: 1, title: "<b>Book</b>", change: { before: snapshot, after: snapshot } });
    assert.ok(!mail.html.includes("<script>") && !mail.html.includes("<img src=x")); assert.match(mail.html, /&lt;script&gt;/);
  } finally { globalThis.fetch = originalFetch; f.close(); }
});

test("provider rate limits defer unaccepted mail without rapid retries and account erasure cascades its private delivery ledger", async () => {
  const f = fixture(), originalFetch = globalThis.fetch;
  try {
    const group = (await f.create(1)).group;
    await f.context(1, group, () => f.load("db/meeting-mail").saveMeetingMailPreference(true));
    const created = await f.meeting(1, group, { kind: "online" });
    await f.action(1, group.id, { action: "editMeeting", meetingId: created.body.meetingId, date: "2028-10-21T19:00", kind: "online", revision: 1 });
    f.env.SELF_SERVICE_LOCAL = "false"; f.env.MEETING_MAIL_ENABLED = "true"; f.env.MEETING_MAIL_FROM = "bildirim@birkoru.com"; f.env.MEETING_MAIL_API_KEY = "synthetic-not-real";
    let requests = 0;
    globalThis.fetch = async (url) => { assert.equal(url, "https://api.resend.com/emails/batch"); requests++; return Response.json({}, { status: 429, headers: { "Retry-After": "120" } }); };
    await f.flush(); assert.equal(requests, 1);
    assert.equal(f.sql.prepare("SELECT status FROM meeting_mail_deliveries").get().status, "pending");
    await f.context(1, group, () => f.load("db/meeting-mail").dispatchMeetingChanges()); assert.equal(requests, 1);
    f.sql.prepare("UPDATE meeting_mail_deliveries SET retry_after=0").run();
    globalThis.fetch = async (url) => { assert.equal(url, "https://api.resend.com/emails/batch"); requests++; return Response.json({ data: [{ id: "synthetic-provider-id" }] }); };
    await f.context(1, group, () => f.load("db/meeting-mail").dispatchMeetingChanges());
    assert.equal(requests, 2); assert.equal(f.sql.prepare("SELECT status FROM meeting_mail_deliveries").get().status, "accepted");
    f.sql.prepare("DELETE FROM account_profiles WHERE member_id=1").run();
    f.sql.prepare("DELETE FROM member_accounts WHERE member_id=1").run();
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM meeting_mail_deliveries").get().n, 0);
  } finally { globalThis.fetch = originalFetch; f.close(); }
});
