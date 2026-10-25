-- Futsal Aytré : schéma initial (Cloudflare D1)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
  level INTEGER NOT NULL DEFAULT 3 CHECK (level BETWEEN 1 AND 5),
  code_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE devices (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  host_user INTEGER NOT NULL,
  teams TEXT NOT NULL,
  live TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  max INTEGER NOT NULL DEFAULT 12,
  created_at INTEGER NOT NULL
);
-- une seule session active à la fois
CREATE UNIQUE INDEX one_active_session ON sessions (status) WHERE status = 'active';

CREATE TABLE matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  date TEXT NOT NULL,
  a TEXT NOT NULL,
  b TEXT NOT NULL,
  sa INTEGER NOT NULL,
  sb INTEGER NOT NULL,
  session_id INTEGER NOT NULL REFERENCES sessions (id),
  UNIQUE (session_id, ts)
);

-- compteur de version : le client ne recharge les données que si elles ont changé
CREATE TABLE meta (v INTEGER NOT NULL);
INSERT INTO meta (v) VALUES (1);

-- limitation des essais de code (anti force brute)
CREATE TABLE attempts (ip TEXT NOT NULL, ts INTEGER NOT NULL);
CREATE INDEX attempts_ip ON attempts (ip, ts);
