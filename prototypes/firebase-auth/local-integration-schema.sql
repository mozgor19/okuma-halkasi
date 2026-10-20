-- LOCAL SYNTHETIC CANONICAL DB ONLY. Not a production Drizzle migration.
CREATE TABLE firebase_local_environment (
  singleton integer PRIMARY KEY NOT NULL CHECK(singleton=1),
  project_id text NOT NULL CHECK(project_id='demo-koru-auth-local')
);
INSERT INTO firebase_local_environment VALUES(1,'demo-koru-auth-local');
CREATE TABLE firebase_local_registrations (
  id text PRIMARY KEY NOT NULL,
  project_id text NOT NULL,
  firebase_uid text,
  email text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  name text NOT NULL,
  expires_at integer NOT NULL,
  member_id integer REFERENCES members(id),
  consumed_at integer,
  UNIQUE(project_id,firebase_uid)
);
CREATE TABLE firebase_local_links (
  member_id integer PRIMARY KEY NOT NULL REFERENCES member_accounts(member_id),
  project_id text NOT NULL,
  firebase_uid text NOT NULL,
  mutation_pending integer NOT NULL DEFAULT 0 CHECK(mutation_pending IN (0,1)),
  UNIQUE(project_id,firebase_uid)
);
CREATE TABLE firebase_local_sessions (
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
CREATE INDEX firebase_local_sessions_member ON firebase_local_sessions(member_id);
CREATE TABLE firebase_local_actions (
  token_hash text PRIMARY KEY NOT NULL,
  purpose text NOT NULL CHECK(purpose IN ('verify','reset')),
  project_id text NOT NULL,
  firebase_uid text NOT NULL,
  email text NOT NULL,
  sealed_code text NOT NULL,
  expires_at integer NOT NULL,
  consumed_at integer
);
