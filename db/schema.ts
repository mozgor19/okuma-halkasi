import { sql } from "drizzle-orm";
import { blob, check, integer, sqliteTable, text, primaryKey, unique } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  role: text("role").notNull().default("member"),
  color: text("color").notNull().default("#5e8b88"),
  avatarMediaKey: text("avatar_media_key"),
  faceReferenceMediaKey: text("face_reference_media_key"),
  faceRecognitionConsent: integer("face_recognition_consent", { mode: "boolean" }).notNull().default(false),
  isGuest: integer("is_guest", { mode: "boolean" }).notNull().default(false),
  guestMeetingId: integer("guest_meeting_id"),
});
export const memberAccounts = sqliteTable("member_accounts", {
  memberId: integer("member_id").primaryKey().references(() => members.id),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  passwordIterations: integer("password_iterations").notNull(),
  sessionVersion: integer("session_version").notNull().default(1),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: text("locked_until"),
  passwordChangedAt: text("password_changed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const readingGroups = sqliteTable("reading_groups", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  bindingName: text("binding_name").notNull().unique(),
}, (table) => [
  check("reading_groups_default_binding", sql`(${table.id} = 'default' AND ${table.bindingName} = 'DB') OR (${table.id} <> 'default' AND ${table.bindingName} <> 'DB')`),
]);

export const readingGroupMemberships = sqliteTable("reading_group_memberships", {
  accountMemberId: integer("account_member_id").notNull().references(() => members.id),
  groupId: text("group_id").notNull().references(() => readingGroups.id),
  memberId: integer("member_id").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  scheme: text("scheme", { enum: ["editorial", "catalogue", "notebook", "minimal"] }).notNull().default("notebook"),
  colorMode: text("color_mode", { enum: ["light", "dark", "system"] }).notNull().default("system"),
}, (table) => [
  primaryKey({ columns: [table.accountMemberId, table.groupId] }),
  unique().on(table.groupId, table.memberId),
  check("reading_group_memberships_member_id", sql`${table.memberId} > 0`),
  check("reading_group_memberships_is_active", sql`${table.isActive} IN (0, 1)`),
  check("reading_group_memberships_scheme", sql`${table.scheme} IN ('editorial', 'catalogue', 'notebook', 'minimal')`),
  check("reading_group_memberships_color_mode", sql`${table.colorMode} IN ('light', 'dark', 'system')`),
]);

export const books = sqliteTable("books", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  author: text("author").notNull(),
  publisher: text("publisher"),
  pages: integer("pages"),
  isbn: text("isbn"),
  coverUrl: text("cover_url"),
  sourceUrl: text("source_url"),
});
export const meetings = sqliteTable("meetings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookId: integer("book_id").notNull().references(() => books.id),
  date: text("date").notNull(),
  location: text("location").notNull(),
  mapUrl: text("map_url"),
  note: text("note"),
  readingScope: text("reading_scope"),
  bookStatus: text("book_status").notNull().default("completed"),
  createdBy: integer("created_by").notNull().references(() => members.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
});
export const attendance = sqliteTable("attendance", {
  meetingId: integer("meeting_id").notNull().references(() => meetings.id),
  memberId: integer("member_id").notNull().references(() => members.id),
  readingStatus: text("reading_status").notNull().default("unselected"),
  currentPage: integer("current_page"),
}, (table) => [primaryKey({ columns: [table.meetingId, table.memberId] })]);
export const meetingRsvps = sqliteTable("meeting_rsvps", {
  meetingId: integer("meeting_id").notNull().references(() => meetings.id),
  memberId: integer("member_id").notNull().references(() => members.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.meetingId, table.memberId] })]);

export const reviews = sqliteTable("reviews", {
  meetingId: integer("meeting_id").notNull().references(() => meetings.id),
  memberId: integer("member_id").notNull().references(() => members.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.meetingId, table.memberId] })]);
export const media = sqliteTable("media", {
  mediaKey: text("media_key").primaryKey(),
  contentType: text("content_type").notNull(),
  data: blob("data", { mode: "buffer" }).notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const photos = sqliteTable("photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id),
  mediaKey: text("media_key").notNull(),
  uploadedBy: integer("uploaded_by").notNull().references(() => members.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const roadmap = sqliteTable("roadmap", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookId: integer("book_id").notNull().references(() => books.id),
  plannedDate: text("planned_date"),
  note: text("note"),
  createdBy: integer("created_by").notNull().references(() => members.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
});

export const favoriteBooks = sqliteTable("favorite_books", {
  memberId: integer("member_id").notNull().references(() => members.id),
  bookId: integer("book_id").notNull().references(() => books.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.memberId, table.bookId] })]);

export const bookVotes = sqliteTable("book_votes", {
  memberId: integer("member_id").primaryKey().references(() => members.id),
  roadmapId: integer("roadmap_id").notNull().references(() => roadmap.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const clubSettings = sqliteTable("club_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
