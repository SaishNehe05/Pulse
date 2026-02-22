-- ============================================================
-- PULSE: Fix Push Notification Trigger (Final)
-- Run this in your Supabase SQL Editor
-- ============================================================
-- STEP 1: Replace <YOUR_SERVICE_ROLE_KEY> below with your actual
--         Supabase service role key.
--         Find it at: Dashboard → Settings → API → service_role (secret)
-- ============================================================

-- Ensure pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Re-create the trigger function with the correct service role key
CREATE OR REPLACE FUNCTION notify_push_on_notification_insert()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://lkvjnjhiiakhuenbbeaw.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
    ),
    body    := to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach the trigger to the notifications table
DROP TRIGGER IF EXISTS on_notification_insert ON notifications;
CREATE TRIGGER on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_notification_insert();

SELECT 'Push notification trigger updated successfully.' AS status;
