import { sql } from "drizzle-orm";
import { blob, integer, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  role: text("role").notNull().default("member"),
  color: text("color").notNull().default("#5e8b88"),
});
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
  createdBy: integer("created_by").notNull().references(() => members.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const attendance = sqliteTable("attendance", {
  meetingId: integer("meeting_id").notNull().references(() => meetings.id),
  memberId: integer("member_id").notNull().references(() => members.id),
  readingStatus: text("reading_status").notNull().default("unselected"),
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
});
