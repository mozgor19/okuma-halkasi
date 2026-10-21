-- Canonical DB only. Existing memberships and tour records are unchanged.
CREATE TABLE account_appearance (
  member_id integer PRIMARY KEY NOT NULL REFERENCES member_accounts(member_id) ON DELETE CASCADE,
  scheme text NOT NULL CHECK (scheme IN ('editorial', 'catalogue', 'notebook', 'minimal')),
  color_mode text NOT NULL CHECK (color_mode IN ('light', 'dark', 'system')),
  updated_at integer NOT NULL
);
