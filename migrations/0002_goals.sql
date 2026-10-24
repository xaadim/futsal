-- Buteurs : un enregistrement par but (équipe créditée, joueur, contre son camp)
CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  team TEXT NOT NULL,
  player TEXT NOT NULL DEFAULT '',
  own_goal INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX goals_match ON goals (match_id);
