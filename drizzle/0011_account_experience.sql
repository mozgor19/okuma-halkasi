-- Canonical DB only. Applying this migration does not erase any account data.
CREATE TABLE account_experience (
  member_id integer PRIMARY KEY NOT NULL REFERENCES member_accounts(member_id),
  tour_version integer NOT NULL CHECK (tour_version > 0),
  tour_state text NOT NULL CHECK (tour_state IN ('completed', 'dismissed')),
  updated_at integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE account_deletion_requests (
  id text PRIMARY KEY NOT NULL,
  member_id integer NOT NULL UNIQUE REFERENCES member_accounts(member_id),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'processing', 'cancelled', 'completed')),
  requested_at integer NOT NULL,
  updated_at integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX account_deletion_requests_status ON account_deletion_requests(status, requested_at);
