-- ---------------------------------------------------------------------------
-- Default images: the app's own picture library
-- ---------------------------------------------------------------------------
--
-- A location in this app has two kinds of picture, and they are not the same
-- thing:
--
--   1. What people have posted -- activity_images, hanging off activities by
--      slug. This is the point of the app, and it always wins.
--   2. A default image from a free source, for a location nobody has posted
--      to yet, so it is not a blank frame while it waits for its first photo.
--
-- This table is only the second kind. It is keyed by the SAME identity as
-- activities.slug (see computeSlug: 'gpid-<place id>' when Google gave us
-- one, otherwise normalised name--city--address), so a location has one id
-- across both kinds of picture and the two can be looked up together.
--
-- Why in the database rather than in each browser, which is where this used
-- to live:
--
--   * Every visitor was repeating the same work. A hundred people in one city
--     each asked the same questions and each got the same answers.
--   * Nothing accumulated. Clearing site data put the app back to knowing
--     nothing about anywhere.
--   * Negatives were lost the same way, so locations with no free photograph
--     were asked about again and again, forever.
--
-- Resolved once, by whoever gets there first, then served to everybody.
--
-- There is deliberately no foreign key to activities: a default image is
-- resolved the moment a location appears in a feed, which is long before
-- anyone interacts with it and therefore before an activities row exists.
-- The slug is the shared identity, not a dependency.

create table if not exists public.place_images (
  -- Same identity as activities.slug.
  location_id  text primary key,

  -- The image, or null for "we looked, and there is no free photograph".
  -- A null here is a real answer and must not be read as a missing row.
  url          text,

  -- 'wikipedia' | 'commons' | 'ticketmaster'. Kept so that a source which
  -- turns out to be unreliable can be cleared out on its own, and so
  -- attribution can be shown wherever the licence asks for it.
  source       text,

  -- The page or file it came from: for attribution, and for auditing a bad
  -- match after the fact.
  source_title text,
  source_url   text,

  -- The name we searched for. Kept because the interesting bugs here are
  -- wrong matches, and without this there is no way to see why.
  query_name   text,

  resolved_at  timestamptz not null default now(),
  hits         integer not null default 0
);

comment on table public.place_images is
  'Default images for locations that have no user photos yet, keyed by the same slug as activities. A null url is a recorded negative, not a gap. User-posted photos live in activity_images and always take precedence. Written only by service_role via the place-images edge function.';

-- Negatives are worth re-checking eventually: a location with no article
-- today may have one next year. Resolution age is what that query needs.
create index if not exists place_images_resolved_idx on public.place_images (resolved_at);
create index if not exists place_images_source_idx on public.place_images (source);

alter table public.place_images enable row level security;

-- Same posture as places_cache: server-side only. The browser asks the
-- function rather than the table, which is what lets one person's lookup
-- serve everybody without letting anyone holding the anon key scrape the
-- library or poison it with images of their choosing.
revoke all on public.place_images from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Hit counting
-- ---------------------------------------------------------------------------
--
-- Worth knowing which images are actually carrying the feed, and doing it in
-- one statement rather than a round trip per row. Service-role only, like the
-- table itself.

create or replace function public.bump_place_image_hits(p_ids text[])
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.place_images
     set hits = hits + 1
   where location_id = any(p_ids);
$$;

revoke all on function public.bump_place_image_hits(text[]) from public, anon, authenticated;
grant execute on function public.bump_place_image_hits(text[]) to service_role;
