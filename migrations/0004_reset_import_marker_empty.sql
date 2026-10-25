UPDATE app_settings
SET value = '0'
WHERE name = 'supabase_imported'
  AND (SELECT COUNT(*) FROM matches) = 0
  AND (SELECT COUNT(*) FROM sessions) = 0;