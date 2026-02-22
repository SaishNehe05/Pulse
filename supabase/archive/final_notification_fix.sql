-- ============================================================
-- PULSE: Final Robust Notification Fix
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- PART 1: Strict Push Token Uniqueness
-- ============================================================

-- 1a. Remove duplicates (keep the most recently updated one)
DELETE FROM push_tokens
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, device_type) id
  FROM push_tokens
  ORDER BY user_id, device_type, updated_at DESC NULLS LAST
);

-- 1b. Add a strict unique index on user_id and device_type
-- This ensures that even if nulls are involved, the combination is unique
DROP INDEX IF EXISTS idx_push_tokens_user_device_unique;
CREATE UNIQUE INDEX idx_push_tokens_user_device_unique ON push_tokens (user_id, device_type);

-- 1c. Ensure the token itself is unique
ALTER TABLE push_tokens DROP CONSTRAINT IF EXISTS push_tokens_token_unique;
ALTER TABLE push_tokens ADD CONSTRAINT push_tokens_token_unique UNIQUE (token);


-- PART 2: Strict Notification Uniqueness
-- ============================================================

-- 2a. Clean up duplicate notification rows
-- This keeps only the most recent notification for a specific action
DELETE FROM notifications
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, actor_id, type, COALESCE(post_id::text, '')) id
  FROM notifications
  ORDER BY user_id, actor_id, type, COALESCE(post_id::text, ''), created_at DESC
);

-- 2b. Drop existing buggy constraints
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_unique_per_action;

-- 2c. Create two partial unique indexes to handle NULL post_id correctly
-- Standard UNIQUE constraints allow multiple NULLs, so we use indexes
DROP INDEX IF EXISTS idx_notifications_unique_with_post;
CREATE UNIQUE INDEX idx_notifications_unique_with_post 
ON notifications (user_id, actor_id, type, post_id) 
WHERE post_id IS NOT NULL;

DROP INDEX IF EXISTS idx_notifications_unique_without_post;
CREATE UNIQUE INDEX idx_notifications_unique_without_post 
ON notifications (user_id, actor_id, type) 
WHERE post_id IS NULL;


-- PART 3: Verification
-- ============================================================
SELECT 'FINAL FIX APPLIED SUCCESSFULLY' as status,
       (SELECT count(*) FROM push_tokens) as total_push_tokens,
       (SELECT count(*) FROM notifications) as total_notifications;
