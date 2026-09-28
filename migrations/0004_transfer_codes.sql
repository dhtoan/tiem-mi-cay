CREATE TABLE IF NOT EXISTS sync_codes (
  code TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_codes_expires_at
  ON sync_codes(expires_at);
