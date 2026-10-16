import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { groupsSettingsPath, groupsSeedPath, testOrigin } from "./test-environment.mjs";

const origin = testOrigin;
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(origin).hostname)
  || !existsSync(groupsSeedPath)) {
  throw new Error("Tests require the isolated loopback groups development profile.");
}
const { password } = JSON.parse(readFileSync(groupsSettingsPath, "utf8"));
let checks = 0;
async function check(name, run) { await run(); checks += 1; console.log(`ok ${checks} - ${name}`); }

class Client {
  cookies = new Map();
  group = null;
  async request(path, options = {}) {
    const { json, expected = 200, group = this.group, ...init } = options;
    const headers = new Headers(init.headers);
    headers.set("Origin", origin);
    headers.set("Cookie", [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "));
    if (group) headers.set("X-Reading-Group", group);
    if (json !== undefined) { headers.set("Content-Type", "application/json"); init.body = JSON.stringify(json); }
    const response = await fetch(origin + path, { ...init, headers, redirect: "manual" });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const separator = pair.indexOf("=");
      const key = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (/max-age=0/i.test(cookie)) this.cookies.delete(key);
      else this.cookies.set(key, value);
    }
    assert.equal(response.status, expected, `${init.method || "GET"} ${path}: expected ${expected}, got ${response.status} ${response.status !== expected ? await response.text() : ""}`);
    return response;
  }
  async login(username = "demo.multi", candidate = password) {
    this.group = null;
    return (await this.request("/api/auth/login", { method: "POST", json: { username, password: candidate } })).json();
  }
  async select(groupId) {
    const result = await (await this.request("/api/groups", { method: "POST", group: groupId, json: { groupId } })).json();
    this.group = groupId;
    return result.group;
  }
  async state() { return (await this.request("/api/state")).json(); }
  async action(action, payload = {}, expected = 200) {
    return (await this.request("/api/action", { method: "POST", json: { action, ...payload }, expected })).json();
  }
  async upload(purpose, fields = {}, expected = 200) {
    const body = new FormData();
    // Valid one-pixel PNG, synthetic and free of personal data.
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jYfcAAAAASUVORK5CYII=", "base64");
    body.set("file", new Blob([png], { type: "image/png" }), "test.png");
    body.set("purpose", purpose);
    for (const [key, value] of Object.entries(fields)) body.set(key, String(value));
    return (await this.request("/api/upload", { method: "POST", body, expected })).json();
  }
}

const web = new Client();
const mobile = new Client();
const single = new Client();
const nonce = Date.now().toString(36);
let createdMeeting, createdPlan, uploadedPhoto, avatarKey;

await check("unauthenticated state and protected media are rejected", async () => {
  await web.request("/api/state", { expected: 401 });
  await web.request("/api/media/11111111-1111-4111-8111-111111111111", { expected: 401 });
});
await check("single membership opens directly with existing member role", async () => {
  assert.equal((await single.login("demo.single")).next, "/");
  const state = await single.state();
  assert.equal(state.readingGroup.id, "default");
  assert.equal(state.members.find((member) => member.id === state.currentMemberId).role, "member");
  await single.request("/api/groups", { method: "POST", group: "second", json: { groupId: "second" }, expected: 403 });
});
await check("multiple memberships require selection after every fresh login", async () => {
  assert.equal((await web.login()).next, "/groups");
  assert.equal((await mobile.login()).next, "/groups");
  const response = await web.request("/api/state", { expected: 409 });
  assert.equal((await response.json()).code, "GROUP_SELECTION_REQUIRED");
  const groups = await (await web.request("/api/groups")).json();
  assert.equal(groups.enabled, true);
  assert.equal(groups.selectedGroupId, null);
  assert.deepEqual(groups.groups.map((group) => group.id).sort(), ["default", "second"]);
});
await check("an account without membership cannot sign in", async () => {
  const client = new Client();
  await client.request("/api/auth/login", { method: "POST", json: { username: "demo.none", password }, expected: 403 });
  assert.equal(client.cookies.has("okuma_session"), false);
});
await check("group selection verifies membership, header and origin", async () => {
  await web.request("/api/groups", { method: "POST", group: "missing", json: { groupId: "missing" }, expected: 403 });
  await web.request("/api/groups", { method: "POST", json: { groupId: "default" }, expected: 409 });
  assert.equal((await web.select("default")).role, "super_admin");
  assert.equal((await mobile.select("second")).role, "member");
});
await check("overlapping IDs resolve to independent group data and roles", async () => {
  const a = await web.state(), b = await mobile.state();
  assert.equal(a.books.find((book) => book.id === 1).title, "Birinci Grup Kitabı");
  assert.equal(b.books.find((book) => book.id === 1).title, "İkinci Grup Kitabı");
  assert.equal(a.currentMemberId, b.currentMemberId);
  assert.equal(a.members.find((member) => member.id === 1).role, "super_admin");
  assert.equal(b.members.find((member) => member.id === 1).role, "member");
});
await check("stale group writes, reads and media/calendar links are rejected", async () => {
  await web.request("/api/action", { method: "POST", group: "second", json: { action: "toggleFavorite", bookId: 1, active: true }, expected: 409 });
  await web.request("/api/action", { method: "POST", group: null, json: { action: "toggleFavorite", bookId: 1, active: true }, expected: 409 });
  await web.request("/api/state?group=second", { expected: 409 });
  await web.request("/api/calendar/1?group=second", { expected: 409 });
  await web.request("/api/media/11111111-1111-4111-8111-111111111111?group=second", { expected: 409 });
  await web.request("/api/state?group=default&group=default", { expected: 409 });
});
await check("group-local role is enforced for direct admin operations", async () => {
  await mobile.action("createMeeting", { bookId: 1, date: "2099-03-01T15:00", location: "Test" }, 403);
  await single.action("setMemberRole", { targetId: 1, role: "member" }, 409); // Missing group context is rejected first.
  single.group = "default";
  await single.action("setMemberRole", { targetId: 1, role: "member" }, 403);
  await mobile.action("purgeTrash", { trashType: "meeting", targetId: 1 }, 403);
});
await check("appearance is per account+group and visible from a second session", async () => {
  await web.request("/api/groups/appearance", { method: "PATCH", json: { scheme: "minimal", mode: "dark" } });
  await mobile.request("/api/groups/appearance", { method: "PATCH", json: { scheme: "catalogue", mode: "light" } });
  assert.equal((await web.state()).readingGroup.scheme, "minimal");
  assert.equal((await mobile.state()).readingGroup.scheme, "catalogue");
  await mobile.select("default");
  assert.equal((await mobile.state()).readingGroup.mode, "dark");
  await web.request("/api/groups/appearance", { method: "PATCH", json: { scheme: "invalid" }, expected: 400 });
  await web.request("/api/groups/appearance", { method: "PATCH", json: { role: "super_admin" }, expected: 400 });
});
await check("favorites and RSVP sync between independent web/mobile sessions", async () => {
  await web.action("toggleFavorite", { bookId: 1, active: false });
  await web.action("setMeetingRsvp", { meetingId: 1, active: false });
  await mobile.action("toggleFavorite", { bookId: 1, active: true });
  await mobile.action("setMeetingRsvp", { meetingId: 1, active: true });
  await mobile.action("setMeetingRsvp", { meetingId: 1, active: true });
  const state = await web.state();
  assert.ok(state.favorites.some((item) => item.bookId === 1 && item.memberId === 1));
  assert.equal(state.meetingRsvps.filter((item) => item.meetingId === 1 && item.memberId === 1).length, 1);
  await mobile.select("second");
  await mobile.action("toggleFavorite", { bookId: 1, active: false });
  await mobile.action("setMeetingRsvp", { meetingId: 1, active: false });
  const other = await mobile.state();
  assert.equal(other.favorites.filter((item) => item.memberId === 1).length, 0);
  assert.equal(other.meetingRsvps.filter((item) => item.memberId === 1).length, 0);
  assert.ok((await web.state()).favorites.some((item) => item.bookId === 1 && item.memberId === 1));
});
await check("review validation, updates and page progress preserve group isolation", async () => {
  await web.action("review", { meetingId: 1, readingStatus: "read", rating: null }, 400);
  await web.action("review", { meetingId: 1, readingStatus: "partial", rating: 8, comment: "Synthetic review", currentPage: 100 });
  await mobile.action("review", { meetingId: 1, readingStatus: "unread", rating: null, currentPage: null });
  const state = await web.state();
  assert.equal(state.reviews.find((item) => item.meetingId === 1 && item.memberId === 1).rating, 8);
  assert.equal(state.attendance.find((item) => item.meetingId === 1 && item.memberId === 1).currentPage, 100);
  assert.ok(!(await mobile.state()).reviews.some((item) => item.memberId === 1 && item.meetingId === 1));
  await web.action("review", { meetingId: 1, readingStatus: "partial", rating: 8, currentPage: 9999 }, 400);
});
await check("meeting create/edit/continuation use the selected group only", async () => {
  const result = await web.action("createMeeting", { book: { title: `Test ${nonce}`, author: "Synthetic Author", pages: 200 }, date: "2099-03-01T15:00", location: "Test location", readingScope: "1-100", bookStatus: "continuing" });
  createdMeeting = result.meetingId;
  assert.ok(createdMeeting);
  await web.action("editMeeting", { meetingId: createdMeeting, date: "2099-03-02T16:00", location: "Updated", readingScope: "1-120", bookStatus: "continuing" });
  const state = await web.state();
  const meeting = state.meetings.find((item) => item.id === createdMeeting);
  assert.equal(meeting.location, "Updated");
  assert.ok(!(await mobile.state()).books.some((book) => book.title === `Test ${nonce}`));
  const continuation = await web.action("createMeeting", { bookId: meeting.bookId, date: "2099-04-01T15:00", location: "Continuation", readingScope: "121-200", bookStatus: "completed" });
  assert.equal((await web.state()).meetings.find((item) => item.id === continuation.meetingId).bookId, meeting.bookId);
  await web.action("deleteMeeting", { meetingId: continuation.meetingId });
  await web.action("purgeTrash", { trashType: "meeting", targetId: continuation.meetingId });
});
await check("members and guests remain group scoped and guest is purged with meeting", async () => {
  await web.action("addAttendance", { meetingId: createdMeeting, targetId: 2 });
  await web.action("addGuest", { meetingId: createdMeeting, guestName: `Guest ${nonce}` });
  const a = await web.state(), b = await mobile.state();
  assert.ok(a.members.some((member) => member.name === `Guest ${nonce}` && member.isGuest));
  assert.ok(!b.members.some((member) => member.name === `Guest ${nonce}`));
});
await check("uploads, avatars, protected media, calendar and image deletion work", async () => {
  const photo = await web.upload("photo", { meetingId: createdMeeting });
  uploadedPhoto = (await web.state()).photos.find((item) => item.mediaKey === photo.mediaKey).id;
  const mediaPath = new URL(photo.url, origin).pathname;
  const response = await web.request(mediaPath + "?group=default");
  assert.equal(response.headers.get("content-type"), "image/png");
  await mobile.request(mediaPath + "?group=second", { expected: 404 });
  avatarKey = (await web.upload("avatar")).mediaKey;
  assert.equal((await web.state()).members.find((item) => item.id === 1).avatarMediaKey, avatarKey);
  assert.notEqual((await mobile.state()).members.find((item) => item.id === 1).avatarMediaKey, avatarKey);
  const calendar = await web.request(`/api/calendar/${createdMeeting}?group=default`);
  assert.match(await calendar.text(), /BEGIN:VCALENDAR/);
  await mobile.upload("faceReference", { targetMemberId: 2 }, 403);
  await web.action("deletePhoto", { photoId: uploadedPhoto });
  await web.request(mediaPath + "?group=default", { expected: 404 });
});
await check("plans, voting, hidden vote identities and moving plan to meeting work", async () => {
  await web.action("createPlan", { book: { title: `Plan ${nonce}`, author: "Synthetic Author" }, note: "Test plan" });
  let state = await web.state();
  createdPlan = state.roadmap.find((plan) => state.books.find((book) => book.id === plan.bookId)?.title === `Plan ${nonce}`).id;
  await web.action("voteBook", { roadmapId: createdPlan, active: true });
  await single.action("voteBook", { roadmapId: createdPlan, active: true });
  await web.action("setVoteVisibility", { voteVisibility: "secret" });
  const masked = await single.state();
  assert.ok(masked.bookVotes.some((vote) => vote.memberId === 0));
  assert.ok(masked.bookVotes.some((vote) => vote.memberId === 2));
  assert.ok(!(await mobile.state()).bookVotes.some((vote) => vote.roadmapId === createdPlan));
  const moved = await web.action("createMeeting", { planId: createdPlan, date: "2099-05-01T15:00", location: "Moved plan" });
  state = await web.state();
  assert.ok(!state.roadmap.some((plan) => plan.id === createdPlan));
  assert.ok(!state.bookVotes.some((vote) => vote.roadmapId === createdPlan));
  await web.action("setVoteVisibility", { voteVisibility: "open" });
  await web.action("deleteMeeting", { meetingId: moved.meetingId });
  await web.action("purgeTrash", { trashType: "meeting", targetId: moved.meetingId });
});
await check("cover uploads retain canonical media paths and reject another group", async () => {
  const cover = await web.upload("cover");
  const canonicalPath = new URL(cover.url, origin).pathname;
  const result = await web.action("createMeeting", { book: { title: `Cover ${nonce}`, author: "Synthetic Author", coverUrl: cover.url }, date: "2099-06-01T15:00", location: "Cover test" });
  const state = await web.state();
  const meeting = state.meetings.find((item) => item.id === result.meetingId);
  assert.equal(state.books.find((book) => book.id === meeting.bookId).coverUrl, canonicalPath);
  await web.action("createPlan", { book: { title: "Invalid group cover", author: "Synthetic Author", coverUrl: canonicalPath + "?group=second" } }, 400);
  await web.action("deleteMeeting", { meetingId: result.meetingId });
  await web.action("purgeTrash", { trashType: "meeting", targetId: result.meetingId });
});
await check("soft delete, restore and permanent delete preserve group boundaries", async () => {
  await web.action("deleteMeeting", { meetingId: createdMeeting });
  let state = await web.state();
  assert.ok(!state.meetings.some((meeting) => meeting.id === createdMeeting));
  assert.ok(state.trash.some((item) => item.type === "meeting" && item.id === createdMeeting));
  await web.action("restoreTrash", { trashType: "meeting", targetId: createdMeeting });
  assert.ok((await web.state()).meetings.some((meeting) => meeting.id === createdMeeting));
  await web.action("deleteMeeting", { meetingId: createdMeeting });
  await web.action("purgeTrash", { trashType: "meeting", targetId: createdMeeting });
  state = await web.state();
  assert.ok(!state.members.some((member) => member.name === `Guest ${nonce}`));
  assert.ok((await mobile.state()).meetings.some((meeting) => meeting.id === 1));
});
await check("fresh login clears previous group selection and logout clears cookies", async () => {
  assert.equal((await web.login()).next, "/groups");
  assert.equal(web.cookies.has("okuma_group"), false);
  await web.request("/api/state", { expected: 409 });
  await web.select("default");
  await web.request("/api/auth/logout", { method: "POST" });
  assert.equal(web.cookies.has("okuma_session"), false);
  assert.equal(web.cookies.has("okuma_group"), false);
  await web.request("/api/state", { expected: 401 });
});
await check("password change is global and revokes old sessions in every group", async () => {
  const newPassword = password + "-Changed9";
  await web.login(); await web.select("default");
  await mobile.login(); await mobile.select("second");
  await mobile.request("/api/auth/change-password", { method: "POST", json: { currentPassword: password, newPassword, confirmPassword: newPassword } });
  await web.request("/api/state", { expected: 401 });
  await mobile.state();
  // Restore the development fixture so reruns and manual checks stay predictable.
  await mobile.request("/api/auth/change-password", { method: "POST", json: { currentPassword: newPassword, newPassword: password, confirmPassword: password } });
  await web.login(); await web.select("default"); await web.state();
});
await check("fixture appearance restored for manual visual checks", async () => {
  await web.request("/api/groups/appearance", { method: "PATCH", json: { scheme: "notebook", mode: "system" } });
  await mobile.select("second");
  await mobile.request("/api/groups/appearance", { method: "PATCH", json: { scheme: "catalogue", mode: "light" } });
});
console.log(`Passed ${checks} integration scenarios against isolated local D1 databases.`);
