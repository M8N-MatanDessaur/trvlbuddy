-- Per-user "save this place for later" list. Distinct from the
-- activity_completions table (that's about ticking off itinerary steps);
-- this is a free-form bookmark of any Google Place the user finds in the
-- Nearby feed, regardless of whether they ever take a trip there.
--
-- Keyed by (user_id, place_id) so the same Google place can be saved by
-- many users without colliding. We snapshot the display fields so the
-- saved view can render without a Places lookup -- saved-place reads stay
-- free even if the upstream Places API is paused/rate-limited.
create table if not exists public.user_saved_places (
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_id text not null,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  primary_type text,
  primary_type_label text,
  rating double precision,
  user_ratings_total integer,
  price_level integer,
  saved_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create index if not exists user_saved_places_user_idx
  on public.user_saved_places (user_id, saved_at desc);

alter table public.user_saved_places enable row level security;

drop policy if exists "Saved places readable by owner" on public.user_saved_places;
create policy "Saved places readable by owner"
  on public.user_saved_places
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can save places" on public.user_saved_places;
create policy "Users can save places"
  on public.user_saved_places
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can unsave places" on public.user_saved_places;
create policy "Users can unsave places"
  on public.user_saved_places
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can update their saved places" on public.user_saved_places;
create policy "Users can update their saved places"
  on public.user_saved_places
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
