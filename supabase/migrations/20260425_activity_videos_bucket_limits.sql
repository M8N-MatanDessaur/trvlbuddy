-- Raise the per-object size limit on the activity-videos bucket. Default
-- Supabase bucket cap is 50 MiB, which a raw phone clip blows past
-- ("The object exceeded the maximum allowed size"). We accept up to
-- 500 MB so any reasonable handheld capture goes through; the client
-- enforces the same ceiling before kicking off the upload.
--
-- Also pin the MIME allowlist so the bucket only stores actual video
-- bytes — defends against a misrouted form upload mounting an HTML
-- error page or arbitrary blob into the public bucket.

update storage.buckets
set
  file_size_limit = 524288000, -- 500 MB
  allowed_mime_types = array[
    'video/mp4',
    'video/quicktime',
    'video/x-m4v',
    'video/webm',
    'video/3gpp',
    'video/3gpp2'
  ]
where id = 'activity-videos';
