-- ============================================================
-- PULSE: Fix Likes & Follows RLS (Final)
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. FIX LIKES
-- ============================================================
-- Ensure RLS is enabled
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Allow users to view likes (anyone can see who liked what)
DROP POLICY IF EXISTS "Everyone can view likes" ON likes;
CREATE POLICY "Everyone can view likes" ON likes
  FOR SELECT USING (true);

-- Allow authenticated users to insert likes (like a post)
-- We check that the user is liking as themselves
DROP POLICY IF EXISTS "Users can create likes" ON likes;
CREATE POLICY "Users can create likes" ON likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own likes (unlike)
DROP POLICY IF EXISTS "Users can delete own likes" ON likes;
CREATE POLICY "Users can delete own likes" ON likes
  FOR DELETE USING (auth.uid() = user_id);


-- 2. FIX FOLLOWS (Refined)
-- ============================================================
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view follows (needed for follower counts & "Is Following" checks)
DROP POLICY IF EXISTS "Everyone can view follows" ON follows;
CREATE POLICY "Everyone can view follows" ON follows
  FOR SELECT USING (true);

-- Allow users to follow others
DROP POLICY IF EXISTS "Users can follow others" ON follows;
CREATE POLICY "Users can follow others" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Allow users to unfollow
DROP POLICY IF EXISTS "Users can unfollow" ON follows;
CREATE POLICY "Users can unfollow" ON follows
  FOR DELETE USING (auth.uid() = follower_id);


-- 3. Verify
-- ============================================================
SELECT 'RLS Policies for Likes & Follows have been updated.' as status;
