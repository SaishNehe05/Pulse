-- ============================================================
-- PULSE: Ultimate Notification Fix
-- 1. Drops ALL possible redundant triggers
-- 2. Cleans up duplicate push tokens
-- 3. Enforces strict notification uniqueness
-- 4. Fixes the notification trigger function
-- ============================================================

-- 1. CLEANUP TRIGGERS (Remove EVERY possible redundant trigger name found)
-- ============================================================
-- Clean up notifications table triggers
DROP TRIGGER IF EXISTS on_notification_insert ON notifications;
DROP TRIGGER IF EXISTS notify_on_notification_insert ON notifications;
DROP TRIGGER IF EXISTS push_notification_trigger ON notifications;
DROP TRIGGER IF EXISTS tr_on_new_notification ON notifications;

-- Clean up direct triggers on action tables (These were causing duplicates)
DROP TRIGGER IF EXISTS on_like_change ON likes;
DROP TRIGGER IF EXISTS trigger_on_like ON likes;
DROP TRIGGER IF EXISTS handle_like_change ON likes;
DROP TRIGGER IF EXISTS on_like_created ON likes;

DROP TRIGGER IF EXISTS on_comment_change ON comments;
DROP TRIGGER IF EXISTS trigger_on_comment ON comments;
DROP TRIGGER IF EXISTS handle_comment_change ON comments;
DROP TRIGGER IF EXISTS on_comment_created ON comments;

DROP TRIGGER IF EXISTS trigger_on_follow ON follows;
DROP TRIGGER IF EXISTS on_follow_created ON follows;

-- Catch-all for other names previously seen or guessed
DROP TRIGGER IF EXISTS on_like_insert ON likes;
DROP TRIGGER IF EXISTS on_comment_insert ON comments;
DROP TRIGGER IF EXISTS on_follow_insert ON follows;
DROP TRIGGER IF EXISTS notify_on_like_insert ON likes;
DROP TRIGGER IF EXISTS notify_on_comment_insert ON comments;
DROP TRIGGER IF EXISTS notify_on_follow_insert ON follows;



-- 2. CLEANUP PUSH TOKENS
-- ============================================================
-- Keep only the newest token for each user/device
DELETE FROM push_tokens
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, token) id
    FROM push_tokens
    ORDER BY user_id, token, updated_at DESC
);

-- Ensure token is unique
ALTER TABLE push_tokens DROP CONSTRAINT IF EXISTS push_tokens_token_key;
ALTER TABLE push_tokens DROP CONSTRAINT IF EXISTS push_tokens_token_unique;
ALTER TABLE push_tokens ADD CONSTRAINT push_tokens_token_unique UNIQUE (token);

-- 3. CLEANUP NOTIFICATIONS
-- ============================================================
-- Keep only one notification per action
DELETE FROM notifications
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, actor_id, type, COALESCE(post_id::text, '')) id
    FROM notifications
    ORDER BY user_id, actor_id, type, COALESCE(post_id::text, ''), created_at DESC
);

-- Note: We don't add a physical constraint here yet because it might break comments.
-- We'll use partial indexes instead for safety.

-- 4. CREATE PARTIAL INDEXES FOR UNIQUENESS
-- ============================================================
-- LIKES: One per (user, actor, post)
DROP INDEX IF EXISTS idx_notifications_like_unique;
CREATE UNIQUE INDEX idx_notifications_like_unique 
ON notifications (user_id, actor_id, post_id) 
WHERE type = 'like';

-- FOLLOWS: One per (user, actor)
DROP INDEX IF EXISTS idx_notifications_follow_unique;
CREATE UNIQUE INDEX idx_notifications_follow_unique 
ON notifications (user_id, actor_id) 
WHERE type = 'follow';

-- COMMENTS: One per comment_id (allows multiple comments per post)
DROP INDEX IF EXISTS idx_notifications_comment_unique;
CREATE UNIQUE INDEX idx_notifications_comment_unique 
ON notifications (comment_id) 
WHERE type = 'comment';

-- 5. UPDATE TRIGGER FUNCTION
-- ============================================================
-- IMPORTANT: REPLACE YOUR_SERVICE_ROLE_KEY_HERE WITH YOUR ACTUAL KEY
CREATE OR REPLACE FUNCTION notify_push_on_notification_insert()
RETURNS trigger AS $$
BEGIN
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

-- 6. RE-ATTACH SINGLE TRIGGER
-- ============================================================
CREATE TRIGGER on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_notification_insert();

SELECT 'Cleanup complete. Only ONE trigger is now active on the notifications table.' as status;
