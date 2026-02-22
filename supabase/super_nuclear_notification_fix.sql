-- ============================================================
-- PULSE: Super Nuclear Notification Fix (DELETES ALL TRIGGERS)
-- Run this to stop ALL duplicate notifications once and for all.
-- ============================================================

-- 1. KILL EVERY SINGLE TRIGGER ON MESSAGES AND NOTIFICATIONS
-- This uses dynamic SQL to find every trigger, regardless of name.
-- ============================================================
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Drop all triggers on 'messages'
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'messages') LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON messages;';
    END LOOP;
    
    -- Drop all triggers on 'notifications'
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'notifications') LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON notifications;';
    END LOOP;
END $$;

-- 2. CREATE THE SINGLE UNIVERSAL TRIGGER FUNCTION
-- ============================================================
-- REPLACE 'YOUR_SERVICE_ROLE_KEY' ON LINE 33 WITH YOUR KEY
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
      -- Fallback for 'extensions.net' if needed
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
-- These are now the ONLY two push triggers that should exist in your DB.
CREATE TRIGGER tr_push_message_insert AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION notify_push_universal();
CREATE TRIGGER on_notification_insert AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION notify_push_universal();

-- 4. CLEANUP PUSH TOKENS (Stop the "Two tokens per device" issue)
-- ============================================================
-- Delete duplicates based on the token string itself
DELETE FROM push_tokens a USING push_tokens b
WHERE a.id < b.id AND a.token = b.token;

-- Enforce uniqueness on the token so this never happens again
ALTER TABLE push_tokens DROP CONSTRAINT IF EXISTS push_tokens_token_unique;
ALTER TABLE push_tokens ADD CONSTRAINT push_tokens_token_unique UNIQUE (token);

-- 5. DIAGNOSTIC CHECK
-- ============================================================
-- This will show you EXACTLY what triggers are left. You should only see 2 results.
SELECT event_object_table, trigger_name 
FROM information_schema.triggers 
WHERE event_object_table IN ('messages', 'notifications');
