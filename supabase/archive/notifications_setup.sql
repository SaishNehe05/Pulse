-- ============================================================
-- PULSE: Push Notification Setup
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- 1. Ensure push_tokens table exists
-- ============================================================
CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token text NOT NULL UNIQUE,
  device_type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own tokens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'push_tokens' AND policyname = 'Users can manage own tokens'
  ) THEN
    CREATE POLICY "Users can manage own tokens" ON push_tokens
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;


-- 2. Enable pg_net extension (for HTTP calls from triggers)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- 3. Create the trigger function
-- ============================================================
-- IMPORTANT: Replace YOUR_SERVICE_ROLE_KEY_HERE below with your actual key
-- Find it at: Supabase Dashboard → Settings → API → service_role (secret) key
-- ============================================================
CREATE OR REPLACE FUNCTION notify_push_on_notification_insert()
RETURNS trigger AS $$
BEGIN
  PERFORM extensions.net.http_post(
    url := 'https://lkvjnjhiiakhuenbbeaw.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
    ),
    body := to_jsonb(NEW)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Attach trigger to notifications table
-- ============================================================
DROP TRIGGER IF EXISTS on_notification_insert ON notifications;
CREATE TRIGGER on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_notification_insert();
