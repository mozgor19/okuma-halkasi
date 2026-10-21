-- Domain migration: canonical legacy domain AND each dedicated group DB.
CREATE TABLE meeting_details (
  meeting_id integer PRIMARY KEY NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'in_person' CHECK (kind IN ('in_person', 'online')),
  online_url text,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE meeting_change_events (
  id text PRIMARY KEY NOT NULL,
  meeting_id integer NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  payload text NOT NULL,
  created_at integer NOT NULL,
  mail_completed_at integer,
  UNIQUE (meeting_id, revision)
);
--> statement-breakpoint
CREATE INDEX meeting_change_events_recent ON meeting_change_events(created_at);
