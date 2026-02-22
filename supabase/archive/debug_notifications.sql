-- ============================================================
-- PULSE: Debug Duplicate Notifications
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Check for duplicate triggers on 'notifications' table
-- If you see more than one row here, that is the problem!
SELECT trigger_name, action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'notifications';

-- 2. Check push token counts
-- If you see users with > 1 token, that explains multiple notifications
SELECT user_id, count(*) as token_count 
FROM push_tokens 
GROUP BY user_id;

-- 3. (Optional) Run this to clear ALL tokens if you suspect stale ones.
-- You will need to restart the app to re-register your device.
-- DELETE FROM push_tokens;
