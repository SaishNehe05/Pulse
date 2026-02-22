-- ============================================================
-- PULSE: Super Notification Cleanup & Duplicate Fix
-- Run this in your Supabase SQL Editor to stop duplicates 
-- and fix notifications for old accounts.
-- ============================================================

-- 1. DROP ALL POSSIBLE REDUNDANT TRIGGERS
-- ============================================================
-- Message Triggers (Drops all known variants)
DROP TRIGGER IF EXISTS tr_push_message_insert ON messages;
DROP TRIGGER IF EXISTS tr_notify_push_on_message_insert ON messages;
DROP TRIGGER IF EXISTS on_message_insert ON messages;

-- Notification Triggers (Drops all known variants)
DROP TRIGGER IF EXISTS on_notification_insert ON notifications;
DROP TRIGGER IF EXISTS notify_push_on_notification_insert ON notifications;
DROP TRIGGER IF EXISTS notify_on_notification_insert ON notifications;
DROP TRIGGER IF EXISTS push_notification_trigger ON notifications;
DROP TRIGGER IF EXISTS tr_on_new_notification ON notifications;

-- 2. CREATE THE SINGLE UNIVERSAL TRIGGER FUNCTION
-- ============================================================
-- REPLACE 'YOUR_SERVICE_ROLE_KEY' ON LINE 30 WITH YOUR KEY
CREATE OR REPLACE FUNCTION notify_push_universal()
RETURNS trigger AS $$
DECLARE
  payload jsonb;
  target_url text := 'https://lkvjnjhiiakhuenbbeaw.supabase.co/functions/v1/send-push-notification';
  auth_header text := 'Bearer YOUR_SERVICE_ROLE_KEY'; -- <--- REPLACE THIS
BEGIN
  -- Determine payload based on table
  IF (TG_TABLE_NAME = 'messages') THEN
    payload := jsonb_build_object(
      'user_id', NEW.receiver_id,
      'actor_id', NEW.sender_id,
      'type', 'message',
      'id', NEW.id,
      'text', NEW.text
    );
  ELSIF (TG_TABLE_NAME = 'notifications') THEN
    payload := to_jsonb(NEW);
  ELSE
    RETURN NEW;
  END IF;

  -- Attempt HTTP Post (Trying standard 'net' schema FIRST)
  BEGIN
    PERFORM net.http_post(
      url := target_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', auth_header),
      body := payload
    );
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      -- Fallback for some Supabase setups
      PERFORM extensions.net.http_post(
        url := target_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', auth_header),
        body := payload
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Push notification failed for %: %', TG_TABLE_NAME, SQLERRM;
    END;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RE-ATTACH SINGLE REFINED TRIGGERS
-- ============================================================

-- Only ONE trigger for messages
CREATE TRIGGER tr_push_message_insert
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_push_universal();

-- Only ONE trigger for standard notifications
CREATE TRIGGER on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION notify_push_universal();


-- 4. CLEANUP OLD PUSH TOKENS (Fix for "Not working on old accounts")
-- ============================================================
-- This removes duplicate or stale tokens. 
-- The app will re-register the correct token when the user logs back in.
DELETE FROM push_tokens
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, device_type) id
    FROM push_tokens
    ORDER BY user_id, device_type, updated_at DESC
);

SELECT 'Cleanup complete. Duplicate triggers removed. Old tokens pruned.' as status;
