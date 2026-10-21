-- Canonical DB only. Do not apply to dedicated group databases.
CREATE TABLE shared_meeting_details (
  group_id text NOT NULL REFERENCES shared_group_storage(group_id),
  meeting_id integer NOT NULL,
  kind text NOT NULL DEFAULT 'in_person' CHECK (kind IN ('in_person', 'online')),
  online_url text,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at integer NOT NULL,
  PRIMARY KEY (group_id, meeting_id),
  FOREIGN KEY (group_id, meeting_id) REFERENCES shared_meetings(group_id, id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE shared_meeting_change_events (
  group_id text NOT NULL REFERENCES shared_group_storage(group_id),
  id text NOT NULL,
  meeting_id integer NOT NULL,
  revision integer NOT NULL,
  payload text NOT NULL,
  created_at integer NOT NULL,
  mail_completed_at integer,
  PRIMARY KEY (group_id, id),
  UNIQUE (group_id, meeting_id, revision),
  FOREIGN KEY (group_id, meeting_id) REFERENCES shared_meetings(group_id, id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX shared_meeting_change_events_recent ON shared_meeting_change_events(group_id, created_at);
--> statement-breakpoint
CREATE TABLE meeting_mail_preferences (
  account_member_id integer NOT NULL,
  group_id text NOT NULL,
  enabled integer NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  updated_at integer NOT NULL,
  PRIMARY KEY (account_member_id, group_id),
  FOREIGN KEY (account_member_id, group_id) REFERENCES reading_group_memberships(account_member_id, group_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE meeting_mail_deliveries (
  group_id text NOT NULL REFERENCES reading_groups(id),
  event_id text NOT NULL,
  account_member_id integer NOT NULL REFERENCES member_accounts(member_id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'sending', 'accepted', 'skipped', 'failed', 'uncertain')),
  claimed_at integer,
  lease_token text,
  retry_after integer,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  PRIMARY KEY (group_id, event_id, account_member_id)
);
--> statement-breakpoint
CREATE INDEX meeting_mail_deliveries_queue ON meeting_mail_deliveries(group_id, status, created_at);
