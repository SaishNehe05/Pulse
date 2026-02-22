-- ============================================================
-- PULSE: Consolidated & Robust Notification Triggers
-- This script fixes both standard (Like/Comment/Follow) and Chat notifications.
-- ============================================================

-- 1. Identify the correct HTTP schema (Usually 'net')
-- ============================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
        IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
            -- Some setups might have it here
            RAISE NOTICE 'Using extensions.net schema';
        END IF;
    END IF;
END $$;

-- 2. CREATE ROBUST TRIGGER FUNCTION
-- ============================================================
-- IMPORTANT: REPLACE 'YOUR_SERVICE_ROLE_KEY' WITH YOUR ACTUAL KEY
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

  -- Attempt HTTP Post (Trying 'net' first, then 'extensions.net')
  BEGIN
    PERFORM net.http_post(
      url := target_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', auth_header),
      body := payload
    );
  EXCEPTION WHEN OTHERS THEN
    BEGIN
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

-- 3. ATTACH TRIGGERS
-- ============================================================

-- Message Trigger (Chat)
DROP TRIGGER IF EXISTS tr_push_message_insert ON messages;
CREATE TRIGGER tr_push_message_insert
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_push_universal();

-- Notification Trigger (Likes/Comments/Follows)
DROP TRIGGER IF EXISTS on_notification_insert ON notifications;
CREATE TRIGGER on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION notify_push_universal();

-- 4. VERIFICATION
-- ============================================================
SELECT 'Triggers updated successfully' as status;
