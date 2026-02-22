-- ============================================================
-- PULSE: Fix Comments RLS Policies
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- Ensure RLS is enabled on comments table
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read comments (needed to display them)
DROP POLICY IF EXISTS "Everyone can view comments" ON comments;
CREATE POLICY "Everyone can view comments" ON comments
  FOR SELECT USING (true);

-- Allow authenticated users to post comments as themselves
DROP POLICY IF EXISTS "Users can create comments" ON comments;
CREATE POLICY "Users can create comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own comments
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE USING (auth.uid() = user_id);

-- Allow users to update their own comments (optional, for future edit feature)
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE USING (auth.uid() = user_id);

SELECT 'Comments RLS policies applied successfully.' AS status;
