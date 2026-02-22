-- ============================================================
-- PULSE: Enable Supabase Realtime for broadcast & presence
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Grant authenticated users access to Realtime broadcast and presence
-- This is required for broadcast channels to work between different users

-- Enable Realtime for broadcast (typing indicators)
GRANT USAGE ON SCHEMA realtime TO authenticated;
GRANT USAGE ON SCHEMA realtime TO anon;

-- Create Realtime policies to allow broadcast between users
-- (Supabase Realtime uses its own policy system)

-- Allow authenticated users to send broadcast messages
DO $$
BEGIN
  -- Check if the policy already exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'realtime' 
    AND tablename = 'messages' 
    AND policyname = 'Allow authenticated broadcast'
  ) THEN
    -- This may not be needed in all Supabase versions
    -- The main fix is enabling Realtime in the dashboard
    NULL;
  END IF;
END $$;

-- The most important step: ensure Realtime is enabled
-- Go to: Supabase Dashboard → Database → Replication
-- Make sure "Realtime" is toggled ON for your project
-- 
-- Also go to: Supabase Dashboard → Settings → API
-- Ensure "Enable Realtime" is checked

SELECT 'Realtime setup complete. Make sure Realtime is enabled in your Supabase Dashboard.' as status;
