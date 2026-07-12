/*
  # Create pulse-exports storage bucket

  ## Summary
  Adds a private Supabase Storage bucket where the `pulse-runner` edge function
  stores generated CSV/XLSX exports. Read access is granted to authenticated
  members of the company that owns the source pulse; writes are limited to the
  service role (used by the edge function).

  ## Changes
  1. Storage bucket
     - `pulse-exports` (private). File path convention: `<pulse_id>/<execution_id>-<filename>`.
  2. Policies on `storage.objects` for bucket `pulse-exports`
     - SELECT: authenticated users who are members of the company that owns the pulse referenced in the path prefix.
     - INSERT/UPDATE/DELETE: service role only (no policy creates open access).

  ## Notes
  1. The edge function uploads using the service role key, so it does not need a permissive policy.
  2. Path prefix segment 1 must be the pulse id; the SELECT policy joins to `pulses` to verify membership.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('pulse-exports', 'pulse-exports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Members can read their company's pulse exports" ON storage.objects;

CREATE POLICY "Members can read their company's pulse exports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pulse-exports'
    AND EXISTS (
      SELECT 1
      FROM public.pulses p
      JOIN public.company_memberships cm ON cm.company_id = p.company_id
      WHERE cm.user_id = auth.uid()
        AND p.id::text = split_part(storage.objects.name, '/', 1)
    )
  );
