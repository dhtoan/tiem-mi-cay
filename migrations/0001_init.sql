PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Tiệm Mì Cay',
  level INTEGER NOT NULL DEFAULT 1,
  last_seen INTEGER NOT NULL,
  receive_pranks INTEGER NOT NULL DEFAULT 1 CHECK(receive_pranks IN (0,1))
);

CREATE TABLE IF NOT EXISTS leaderboard (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  profit INTEGER NOT NULL,
  day INTEGER NOT NULL,
  served INTEGER NOT NULL,
  level INTEGER NOT NULL,
  rating REAL NOT NULL,
  client_time INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_profit ON leaderboard(profit DESC, served DESC);

CREATE TABLE IF NOT EXISTS challenge_runs (
  token TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  finished_at INTEGER,
  name TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  served INTEGER NOT NULL DEFAULT 0,
  perfect INTEGER NOT NULL DEFAULT 0,
  wrong INTEGER NOT NULL DEFAULT 0,
  lost INTEGER NOT NULL DEFAULT 0,
  UNIQUE(player_id, day, attempt)
);
CREATE INDEX IF NOT EXISTS idx_challenge_day_score ON challenge_runs(day, score DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_player_day ON challenge_runs(player_id, day);

CREATE TABLE IF NOT EXISTS pranks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER,
  UNIQUE(from_id, to_id, day)
);
CREATE INDEX IF NOT EXISTS idx_pranks_inbox ON pranks(to_id, claimed_at, created_at);
CREATE INDEX IF NOT EXISTS idx_pranks_sent ON pranks(from_id, day);