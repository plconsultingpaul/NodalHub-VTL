-- Create the company-logos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload logos for their own companies
CREATE POLICY "authenticated_users_upload_logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
);

-- Allow authenticated users to update/overwrite logos
CREATE POLICY "authenticated_users_update_logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'company-logos')
WITH CHECK (bucket_id = 'company-logos');

-- Allow public read access to logos
CREATE POLICY "public_read_logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-logos');

-- Allow authenticated users to delete logos
CREATE POLICY "authenticated_users_delete_logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'company-logos');
