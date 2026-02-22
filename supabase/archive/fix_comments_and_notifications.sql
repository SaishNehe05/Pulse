-- ============================================================
-- PULSE: Complete Fix for Comments + Duplicate Notifications
-- Run this entire file in your Supabase SQL Editor
-- ============================================================


-- ============================================================
-- PART 1: Fix Comments Table
-- ============================================================

-- Ensure the comments table has the parent_id column for replies
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES comments(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Drop and recreate all policies cleanly
DROP POLICY IF EXISTS "Everyone can view comments" ON comments;
DROP POLICY IF EXISTS "Users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
DROP POLICY IF EXISTS "Users can update own comments" ON comments;

CREATE POLICY "Everyone can view comments" ON comments
  FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE USING (auth.uid() = user_id);

SELECT 'Part 1 done: Comments RLS policies applied.' AS status;


-- ============================================================
-- PART 2: Fix Duplicate Push Tokens
-- IMPORTANT: Delete duplicates BEFORE adding constraints
-- ============================================================

-- 2a. Keep only the LATEST token per (user_id, device_type) — delete all older ones
DELETE FROM push_tokens
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, device_type) id
  FROM push_tokens
  ORDER BY user_id, device_type, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
);

-- 2b. Now it's safe to add the unique constraints
ALTER TABLE push_tokens
  DROP CONSTRAINT IF EXISTS push_tokens_token_key;

ALTER TABLE push_tokens
  DROP CONSTRAINT IF EXISTS push_tokens_token_unique;

ALTER TABLE push_tokens
  ADD CONSTRAINT push_tokens_token_unique UNIQUE (token);

ALTER TABLE push_tokens
  DROP CONSTRAINT IF EXISTS push_tokens_user_device_unique;

ALTER TABLE push_tokens
  ADD CONSTRAINT push_tokens_user_device_unique UNIQUE (user_id, device_type);

SELECT 'Part 2 done: Push token duplicates cleaned and constraints applied.' AS status;


-- ============================================================
-- PART 3: Fix Duplicate Notification Rows
-- ============================================================

-- 3a. Delete duplicate notification rows (keep the most recent per action)
DELETE FROM notifications
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, actor_id, type, COALESCE(post_id::text, '')) id
  FROM notifications
  ORDER BY user_id, actor_id, type, COALESCE(post_id::text, ''), created_at DESC
);

-- 3b. Add unique constraint to prevent future duplicates
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_unique_per_action;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_unique_per_action
  UNIQUE (user_id, actor_id, type, post_id);

SELECT 'Part 3 done: Duplicate notifications cleaned and constrained.' AS status;

SELECT 'ALL FIXES APPLIED SUCCESSFULLY.' AS final_status;
