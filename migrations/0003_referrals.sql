PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS referral_codes (
  code TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS referral_claims (
  invitee_account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  inviter_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_referral_claims_inviter ON referral_claims(inviter_account_id);
CREATE TABLE IF NOT EXISTS referral_rewards (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  pending_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
