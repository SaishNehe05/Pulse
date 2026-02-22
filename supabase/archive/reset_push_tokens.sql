-- ============================================================
-- PULSE: Reset Push Tokens
-- Run this if you are receiving duplicate notifications
-- ============================================================

-- 1. Check how many tokens you currently have
SELECT user_id, count(*) as token_count 
FROM push_tokens 
GROUP BY user_id;

-- 2. Delete ALL push tokens.
-- This forces the app to re-register only the current, valid token when you next open it.
DELETE FROM push_tokens;

SELECT 'All push tokens cleared. Please restart your app to re-register.' as status;
