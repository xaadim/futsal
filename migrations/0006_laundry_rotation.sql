CREATE TABLE laundry_rotation (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  start_date TEXT NOT NULL,
  next_date TEXT NOT NULL,
  created_by INTEGER NOT NULL
);

CREATE TABLE laundry_queue (
  position INTEGER PRIMARY KEY CHECK (position >= 0),
  user_id INTEGER NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE laundry_events (
  date TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('done', 'skip')),
  actor_id INTEGER NOT NULL,
  actor_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);