-- Fix for User Deletion: Add ON DELETE CASCADE to message constraints
-- This script allows a user to be deleted from the 'profiles' table by automatically cleaning up their messages.

-- 1. Drop existing constraints if they exist (to be safe and allow re-run)
ALTER TABLE IF EXISTS public.messages 
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey,
DROP CONSTRAINT IF EXISTS messages_recipient_id_fkey,
DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;

-- 2. Add them back with ON DELETE CASCADE
ALTER TABLE public.messages
ADD CONSTRAINT messages_sender_id_fkey 
FOREIGN KEY (sender_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

ALTER TABLE public.messages
ADD CONSTRAINT messages_receiver_id_fkey 
FOREIGN KEY (receiver_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 3. Also ensure notifications, pulses, and bookmarks are handled
ALTER TABLE IF EXISTS public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.pulses DROP CONSTRAINT IF EXISTS pulses_user_id_fkey;
ALTER TABLE public.pulses ADD CONSTRAINT pulses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.bookmarks DROP CONSTRAINT IF EXISTS bookmarks_user_id_fkey;
ALTER TABLE public.bookmarks ADD CONSTRAINT bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. Handles Posts, Likes, Comments if they aren't already cascading
ALTER TABLE IF EXISTS public.posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE public.posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.likes DROP CONSTRAINT IF EXISTS likes_user_id_fkey;
ALTER TABLE public.likes ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE public.comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Note: repeat this for any other tables that reference profiles.id
-- Likes, Comments, Posts usually already have this if they were created correctly,
-- but if you hit more errors, add them here.
