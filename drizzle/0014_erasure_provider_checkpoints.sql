-- Canonical DB only. Retained with the erasure ledger, never restored as accounts.
CREATE TABLE account_erasure_provider_checkpoints (
  request_id text NOT NULL REFERENCES account_erasure_jobs(request_id),
  project_id text NOT NULL CHECK (project_id = 'koru-951bf'),
  uid_digest text NOT NULL CHECK (length(uid_digest) = 64),
  deleted_at integer,
  PRIMARY KEY (request_id, project_id, uid_digest)
);
