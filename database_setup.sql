-- SQL script for Pulse app database setup
-- Handles cascading deletes and automatic counter updates

-- 1. Cascading Deletes
-- This ensures that when a post is deleted, all associated likes and comments are removed automatically.
ALTER TABLE public.likes
DROP CONSTRAINT IF EXISTS likes_post_id_fkey,
ADD CONSTRAINT likes_post_id_fkey
  FOREIGN KEY (post_id)
  REFERENCES public.posts(id)
  ON DELETE CASCADE;

ALTER TABLE public.comments
DROP CONSTRAINT IF EXISTS comments_post_id_fkey,
ADD CONSTRAINT comments_post_id_fkey
  FOREIGN KEY (post_id)
  REFERENCES public.posts(id)
  ON DELETE CASCADE;

-- 2. Likes Counter Trigger
-- Automatically updates likes_count on the posts table
CREATE OR REPLACE FUNCTION public.handle_like_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts
    SET likes_count = likes_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_change ON public.likes;
CREATE TRIGGER on_like_change
AFTER INSERT OR DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.handle_like_change();

-- 3. Comments Counter Trigger
-- Automatically updates comments_count on the posts table
CREATE OR REPLACE FUNCTION public.handle_comment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts
    SET comments_count = comments_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts
    SET comments_count = GREATEST(0, comments_count - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_change ON public.comments;
CREATE TRIGGER on_comment_change
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.handle_comment_change();

-- 4. Enable RLS and add Deletion Policy
-- This is CRITICAL. Without this, Supabase might silently block deletes.
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can delete their own posts" ON public.posts;
CREATE POLICY "Owners can delete their own posts"
ON public.posts FOR DELETE
TO authenticated
USING ( auth.uid() = user_id );

-- 5. INITIALIZE COUNTS
-- RUN THIS ONCE TO SYNC EXISTING DATA
UPDATE public.posts p
SET 
  likes_count = (SELECT count(*) FROM public.likes l WHERE l.post_id = p.id),
  comments_count = (SELECT count(*) FROM public.comments c WHERE c.post_id = p.id);
