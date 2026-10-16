-- Canonical DB only. Additional group databases contain domain tables, not accounts.
CREATE TABLE reading_groups (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  binding_name text NOT NULL UNIQUE,
  CHECK ((id = 'default' AND binding_name = 'DB') OR (id <> 'default' AND binding_name <> 'DB'))
);
--> statement-breakpoint
CREATE TABLE reading_group_memberships (
  account_member_id integer NOT NULL REFERENCES members(id),
  group_id text NOT NULL REFERENCES reading_groups(id),
  member_id integer NOT NULL CHECK (member_id > 0),
  is_active integer NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  scheme text NOT NULL DEFAULT 'notebook' CHECK (scheme IN ('editorial', 'catalogue', 'notebook', 'minimal')),
  color_mode text NOT NULL DEFAULT 'system' CHECK (color_mode IN ('light', 'dark', 'system')),
  PRIMARY KEY (account_member_id, group_id),
  UNIQUE (group_id, member_id)
);
--> statement-breakpoint
INSERT INTO reading_groups (id, name, binding_name) VALUES ('default', 'Okuma Halkasi', 'DB');
--> statement-breakpoint
INSERT INTO reading_group_memberships (account_member_id, group_id, member_id)
SELECT id, 'default', id FROM members WHERE is_guest = 0;
