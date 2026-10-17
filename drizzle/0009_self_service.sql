-- Canonical DB only. Existing accounts are not assigned guessed email addresses.
CREATE TABLE account_profiles (
  member_id integer PRIMARY KEY NOT NULL REFERENCES member_accounts(member_id),
  email text NOT NULL UNIQUE,
  verified_at integer NOT NULL,
  policy_version text NOT NULL
);
--> statement-breakpoint
CREATE TABLE pending_registrations (
  token_hash text PRIMARY KEY NOT NULL,
  email text NOT NULL,
  username text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  password_iterations integer NOT NULL,
  expires_at integer NOT NULL,
  consumed_at integer,
  member_id integer REFERENCES members(id)
);
--> statement-breakpoint
CREATE INDEX pending_registrations_expiry ON pending_registrations(expires_at);
--> statement-breakpoint
CREATE TABLE account_recovery_tokens (
  token_hash text PRIMARY KEY NOT NULL,
  member_id integer NOT NULL REFERENCES member_accounts(member_id),
  session_version integer NOT NULL,
  expires_at integer NOT NULL,
  consumed_at integer
);
--> statement-breakpoint
CREATE TABLE account_email_verifications (
  token_hash text PRIMARY KEY NOT NULL,
  member_id integer NOT NULL REFERENCES member_accounts(member_id),
  email text NOT NULL,
  session_version integer NOT NULL,
  expires_at integer NOT NULL,
  consumed_at integer
);
--> statement-breakpoint
CREATE TABLE security_rate_limits (
  key text PRIMARY KEY NOT NULL,
  count integer NOT NULL,
  expires_at integer NOT NULL
);
--> statement-breakpoint
-- Used only by the explicitly loopback-only local mail adapter; never a public API.
CREATE TABLE development_mail (
  id text PRIMARY KEY NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  expires_at integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE group_provisioning (
  group_id text PRIMARY KEY NOT NULL REFERENCES reading_groups(id),
  owner_id integer NOT NULL REFERENCES members(id),
  request_key text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'ready')),
  created_at integer NOT NULL,
  UNIQUE(owner_id, request_key)
);
--> statement-breakpoint
CREATE TABLE group_invitations (
  id text PRIMARY KEY NOT NULL,
  group_id text NOT NULL REFERENCES reading_groups(id),
  token_hash text NOT NULL UNIQUE,
  created_by integer NOT NULL REFERENCES members(id),
  created_at integer NOT NULL,
  expires_at integer NOT NULL,
  max_uses integer NOT NULL CHECK (max_uses BETWEEN 1 AND 100),
  revoked_at integer
);
--> statement-breakpoint
CREATE TABLE group_invitation_redemptions (
  account_member_id integer NOT NULL REFERENCES members(id),
  group_id text NOT NULL REFERENCES reading_groups(id),
  invitation_id text NOT NULL REFERENCES group_invitations(id),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'ready')),
  created_at integer NOT NULL,
  PRIMARY KEY(account_member_id, group_id)
);
--> statement-breakpoint
CREATE INDEX group_invitation_redemptions_invite ON group_invitation_redemptions(invitation_id);
