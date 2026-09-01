-- Enforce the same receipt promise at the storage boundary as in the UI.
-- Supabase Storage validates the actual upload bytes and content type, so a
-- caller cannot bypass these controls by forging receipt metadata.

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic'
    ]::text[]
where id = 'receipts';
