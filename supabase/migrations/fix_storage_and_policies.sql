-- ====================================================================
-- SUPABASE STORAGE BUCKET & POLICIES SETUP
-- Note: Do NOT run 'ALTER TABLE storage.objects' because storage.objects
-- is owned by supabase_storage_admin and RLS is ALREADY enabled on it.
-- ====================================================================

-- 1. Create the 'documents' bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  20971520, -- 20 MB
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/tiff',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520;

-- 2. Drop existing policy if present
DROP POLICY IF EXISTS "Authenticated users read own company files" ON storage.objects;

-- 3. Policy allowing company members to read their files
CREATE POLICY "Authenticated users read own company files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    (
      (storage.foldername(name))[1] = 'companies'
      AND EXISTS (
        SELECT 1
        FROM public.company_members AS cm
        WHERE cm.user_id = auth.uid()
          AND (storage.foldername(name))[2] = cm.company_id::text
      )
    )
    OR
    (
      (storage.foldername(name))[1] = 'incoming'
    )
  )
);
