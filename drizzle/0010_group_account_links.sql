-- Domain DBs, including canonical/default. No credentials in additional group DBs.
-- Retry-safe local member allocation for self-service membership provisioning.
CREATE TABLE group_account_links (
  account_member_id integer PRIMARY KEY NOT NULL,
  member_id integer NOT NULL UNIQUE REFERENCES members(id)
);
--> statement-breakpoint
-- A second binding alias cannot claim this physical DB for another group.
CREATE TABLE group_database_ownership (
  singleton integer PRIMARY KEY NOT NULL CHECK (singleton = 1),
  group_id text NOT NULL UNIQUE
);
