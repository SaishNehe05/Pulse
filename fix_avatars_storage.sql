-- PULSE: Fix for Storage Uploads (Avatars & Post Images)
-- This script ensures the required storage buckets exist and have correct permissions.

-- 1. Create buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true), ('post-images', 'post-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing broadly defined policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

-- 3. Create policies for the 'avatars' bucket
CREATE POLICY "Public Access Avatars" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );

CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT TO authenticated
WITH CHECK ( bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "Users can update avatars" ON storage.objects FOR UPDATE TO authenticated
USING ( bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "Users can delete avatars" ON storage.objects FOR DELETE TO authenticated
USING ( bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text );

-- 4. Create policies for the 'post-images' bucket
CREATE POLICY "Public Access Post Images" ON storage.objects FOR SELECT USING ( bucket_id = 'post-images' );

CREATE POLICY "Users can upload post images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK ( bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "Users can update post images" ON storage.objects FOR UPDATE TO authenticated
USING ( bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "Users can delete post images" ON storage.objects FOR DELETE TO authenticated
USING ( bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text );
