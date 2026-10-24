CREATE TABLE app_settings (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO app_settings (name, value) VALUES ('supabase_imported', '0');