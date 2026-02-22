-- ============================================================
-- PULSE: Fix Notification Uniqueness (v2)
-- Run this in Supabase SQL Editor to fix comment posting issues
-- ============================================================

-- 1. Drop the restrictive indexes that were blocking comments
DROP INDEX IF EXISTS idx_notifications_unique_with_post;
DROP INDEX IF EXISTS idx_notifications_unique_without_post;

-- 2. Create more granular uniqueness rules

-- A. LIKES: One notification per user per post
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_like_unique 
ON notifications (user_id, actor_id, post_id) 
WHERE type = 'like';

-- B. FOLLOWS: One notification per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_follow_unique 
ON notifications (user_id, actor_id) 
WHERE type = 'follow';

-- C. COMMENTS: One notification per COMMENT_ID
-- This allows multiple comments on the same post, but prevents duplicate triggers for the same comment
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_comment_unique 
ON notifications (comment_id) 
WHERE type = 'comment';

-- 3. Verification
SELECT 'Notification rules updated successfully' as status;
