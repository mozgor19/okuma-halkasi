-- Canonical DB only. This migration never erases data by itself.
-- Ledger deliberately has no FK to accounts: completed erasures must survive account deletion.
CREATE TABLE account_erasure_jobs (
  request_id text PRIMARY KEY NOT NULL,
  account_member_id integer NOT NULL UNIQUE CHECK (account_member_id > 0),
  plan_json text NOT NULL CHECK (json_valid(plan_json)),
  plan_digest text NOT NULL CHECK (length(plan_digest) = 64),
  completed_bindings text NOT NULL DEFAULT '[]' CHECK (json_valid(completed_bindings)),
  lease_token text,
  frozen_at integer,
  completed_at integer,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX account_erasure_single_runner ON account_erasure_jobs((1)) WHERE lease_token IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX account_erasure_single_pending ON account_erasure_jobs((1)) WHERE completed_at IS NULL;
