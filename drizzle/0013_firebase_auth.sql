-- Canonical DB only. Existing accounts and domain tables remain unchanged.
CREATE TABLE firebase_environment (
  singleton integer PRIMARY KEY NOT NULL CHECK(singleton = 1),
  project_id text NOT NULL CHECK(project_id = 'koru-951bf')
);
--> statement-breakpoint
INSERT INTO firebase_environment VALUES (1, 'koru-951bf');
--> statement-breakpoint
CREATE TABLE firebase_registrations (
  id text PRIMARY KEY NOT NULL,
  project_id text NOT NULL,
  firebase_uid text,
  email text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  name text NOT NULL,
  expires_at integer NOT NULL,
  member_id integer REFERENCES members(id),
  claim_member_id integer REFERENCES member_accounts(member_id),
  claim_version integer,
  consumed_at integer,
  UNIQUE(project_id, firebase_uid),
  CHECK ((claim_member_id IS NULL AND claim_version IS NULL) OR
    (claim_member_id IS NOT NULL AND claim_version IS NOT NULL AND claim_member_id > 0 AND claim_version >= 0))
);
--> statement-breakpoint
CREATE TABLE firebase_links (
  member_id integer PRIMARY KEY NOT NULL REFERENCES member_accounts(member_id),
  project_id text NOT NULL,
  firebase_uid text NOT NULL,
  mutation_pending integer NOT NULL DEFAULT 0 CHECK(mutation_pending IN (0,1)),
  mutation_started_at integer,
  mutation_valid_since integer,
  mutation_kind text CHECK(mutation_kind IN ('password','reset','erasure')),
  UNIQUE(project_id, firebase_uid)
);
--> statement-breakpoint
CREATE TABLE firebase_sessions (
  token_hash text PRIMARY KEY NOT NULL,
  member_id integer NOT NULL REFERENCES member_accounts(member_id),
  session_version integer NOT NULL,
  project_id text NOT NULL,
  firebase_uid text NOT NULL,
  auth_time integer NOT NULL,
  sealed_credentials text NOT NULL,
  expires_at integer NOT NULL,
  revoked_at integer
);
--> statement-breakpoint
CREATE INDEX firebase_sessions_member ON firebase_sessions(member_id);
