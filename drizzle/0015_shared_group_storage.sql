-- Canonical DB only. Additive: no existing table, row, ID or media is moved.
CREATE TABLE shared_group_storage (
  group_id text PRIMARY KEY NOT NULL REFERENCES reading_groups(id),
  CHECK (group_id <> 'default')
);
--> statement-breakpoint
CREATE TABLE shared_members (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  group_id text NOT NULL REFERENCES shared_group_storage(group_id),
  name text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin', 'super_admin')),
  color text NOT NULL DEFAULT '#5e8b88',
  avatar_media_key text,
  face_reference_media_key text,
  face_recognition_consent integer NOT NULL DEFAULT 0 CHECK (face_recognition_consent IN (0, 1)),
  is_guest integer NOT NULL DEFAULT 0 CHECK (is_guest IN (0, 1)),
  guest_meeting_id integer,
  UNIQUE (group_id, id)
);
--> statement-breakpoint
CREATE TABLE shared_books (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  group_id text NOT NULL REFERENCES shared_group_storage(group_id),
  title text NOT NULL, author text NOT NULL, publisher text, pages integer,
  isbn text, cover_url text, source_url text,
  UNIQUE (group_id, id)
);
--> statement-breakpoint
CREATE TABLE shared_meetings (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  group_id text NOT NULL REFERENCES shared_group_storage(group_id),
  book_id integer NOT NULL, date text NOT NULL, location text NOT NULL,
  map_url text, note text, reading_scope text,
  book_status text NOT NULL DEFAULT 'completed',
  created_by integer NOT NULL, created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP, deleted_at text,
  UNIQUE (group_id, id),
  FOREIGN KEY (group_id, book_id) REFERENCES shared_books(group_id, id),
  FOREIGN KEY (group_id, created_by) REFERENCES shared_members(group_id, id)
);
--> statement-breakpoint
CREATE TABLE shared_attendance (
  group_id text NOT NULL REFERENCES shared_group_storage(group_id),
  meeting_id integer NOT NULL, member_id integer NOT NULL,
  reading_status text NOT NULL DEFAULT 'unselected', current_page integer,
  PRIMARY KEY (group_id, meeting_id, member_id),
  FOREIGN KEY (group_id, meeting_id) REFERENCES shared_meetings(group_id, id),
  FOREIGN KEY (group_id, member_id) REFERENCES shared_members(group_id, id)
);
--> statement-breakpoint
CREATE TABLE shared_meeting_rsvps (
  group_id text NOT NULL REFERENCES shared_group_storage(group_id),
  meeting_id integer NOT NULL, member_id integer NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, meeting_id, member_id),
  FOREIGN KEY (group_id, meeting_id) REFERENCES shared_meetings(group_id, id),
  FOREIGN KEY (group_id, member_id) REFERENCES shared_members(group_id, id)
);
--> statement-breakpoint
CREATE TABLE shared_reviews (
  group_id text NOT NULL REFERENCES shared_group_storage(group_id),
  meeting_id integer NOT NULL, member_id integer NOT NULL, rating integer NOT NULL, comment text,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, meeting_id, member_id),
  FOREIGN KEY (group_id, meeting_id) REFERENCES shared_meetings(group_id, id),
  FOREIGN KEY (group_id, member_id) REFERENCES shared_members(group_id, id)
);
--> statement-breakpoint
CREATE TABLE shared_media (
  group_id text NOT NULL REFERENCES shared_group_storage(group_id),
  media_key text NOT NULL, content_type text NOT NULL, data blob NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, media_key)
);
--> statement-breakpoint
CREATE TABLE shared_photos (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  group_id text NOT NULL REFERENCES shared_group_storage(group_id),
  meeting_id integer NOT NULL, media_key text NOT NULL, uploaded_by integer NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (group_id, id),
  FOREIGN KEY (group_id, meeting_id) REFERENCES shared_meetings(group_id, id),
  FOREIGN KEY (group_id, uploaded_by) REFERENCES shared_members(group_id, id)
);
--> statement-breakpoint
CREATE TABLE shared_roadmap (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  group_id text NOT NULL REFERENCES shared_group_storage(group_id),
  book_id integer NOT NULL, planned_date text, note text, created_by integer NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP, deleted_at text,
  UNIQUE (group_id, id),
  FOREIGN KEY (group_id, book_id) REFERENCES shared_books(group_id, id),
  FOREIGN KEY (group_id, created_by) REFERENCES shared_members(group_id, id)
);
--> statement-breakpoint
CREATE TABLE shared_favorite_books (
  group_id text NOT NULL REFERENCES shared_group_storage(group_id),
  member_id integer NOT NULL, book_id integer NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, member_id, book_id),
  FOREIGN KEY (group_id, member_id) REFERENCES shared_members(group_id, id),
  FOREIGN KEY (group_id, book_id) REFERENCES shared_books(group_id, id)
);
--> statement-breakpoint
CREATE TABLE shared_book_votes (
  group_id text NOT NULL REFERENCES shared_group_storage(group_id),
  member_id integer NOT NULL, roadmap_id integer NOT NULL, created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, member_id),
  FOREIGN KEY (group_id, member_id) REFERENCES shared_members(group_id, id),
  FOREIGN KEY (group_id, roadmap_id) REFERENCES shared_roadmap(group_id, id)
);
--> statement-breakpoint
CREATE TABLE shared_club_settings (
  group_id text NOT NULL REFERENCES shared_group_storage(group_id),
  key text NOT NULL, value text NOT NULL,
  PRIMARY KEY (group_id, key)
);
--> statement-breakpoint
CREATE TABLE shared_group_account_links (
  group_id text NOT NULL REFERENCES shared_group_storage(group_id),
  account_member_id integer NOT NULL REFERENCES members(id), member_id integer NOT NULL,
  PRIMARY KEY (group_id, account_member_id),
  UNIQUE (group_id, member_id),
  FOREIGN KEY (group_id, member_id) REFERENCES shared_members(group_id, id)
);
--> statement-breakpoint
CREATE INDEX shared_meetings_group_date ON shared_meetings(group_id, deleted_at, date);
--> statement-breakpoint
CREATE INDEX shared_roadmap_group_date ON shared_roadmap(group_id, deleted_at, planned_date);
--> statement-breakpoint
CREATE INDEX shared_photos_group_member ON shared_photos(group_id, uploaded_by);
--> statement-breakpoint
CREATE INDEX shared_group_account_links_account ON shared_group_account_links(account_member_id, group_id);
