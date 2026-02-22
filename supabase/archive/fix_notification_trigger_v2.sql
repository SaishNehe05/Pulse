-- ============================================================
-- PULSE: Fix Notification Trigger
-- Fixes error: "cross-database references are not implemented: extensions.net.http_post"
-- Run this in Supabase SQL Editor
-- ============================================================

-- Re-create the function with the correct call to net.http_post
-- IMPORTANT: You must replace YOUR_SERVICE_ROLE_KEY_HERE with your actual service role key again!

CREATE OR REPLACE FUNCTION notify_push_on_notification_insert()
RETURNS trigger AS $$
BEGIN
  -- Changed from extensions.net.http_post to net.http_post
  PERFORM net.http_post(
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

SELECT 'Notification trigger function updated.' as status;
