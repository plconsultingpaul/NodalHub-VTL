/*
  Add "Send to Imaging" settings to imaging_vendors.

  The existing supabase_url is reused for the ingest endpoint (same project
  as the retrieve endpoint). We add:

  - send_api_key                     — the shared secret bearer used by the
                                       imaging-ingest edge function.
  - send_bucket_id                   — the bucket UUID PDFs should be written
                                       into. Defaults to the vendor's default
                                       bucket at step-config time when unset.
  - send_default_document_type_id    — optional default document type to
                                       preselect on new Send steps.

  All columns are nullable so existing vendors keep working with retrieve
  only.
*/

ALTER TABLE imaging_vendors
  ADD COLUMN IF NOT EXISTS send_api_key text,
  ADD COLUMN IF NOT EXISTS send_bucket_id text,
  ADD COLUMN IF NOT EXISTS send_default_document_type_id uuid REFERENCES imaging_document_types(id) ON DELETE SET NULL;
