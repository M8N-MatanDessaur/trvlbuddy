-- ---------------------------------------------------------------------------
-- What you actually want to see
-- ---------------------------------------------------------------------------
--
-- A short list of things this person is looking for -- "bagels", "jazz",
-- "markets". The feed pins matches to the top, in the order they are listed,
-- so the first preference wins ties.
--
-- The rule that matters, in the owner's words: "if I say bagels, I want the
-- bagels spot to appear first, but if there is no bagels spot, I don't want
-- to see anything." So a preference is never loosened into something
-- adjacent. Either something genuinely matches and is promoted, or nothing
-- is promoted and the feed is simply the feed. There is no "closest thing to
-- bagels", because that is how a feed starts lying to people.
--
-- Stored on the profile rather than in its own table: it is a handful of
-- short strings, only ever read and written whole, and only ever by their
-- owner.

alter table public.profiles
  add column if not exists preferences text[] not null default '{}';

comment on column public.profiles.preferences is
  'Ordered list of things this person wants to see first in Nearby. Matches are pinned to the top in list order; a preference is never widened into an adjacent category.';

-- A cap, enforced in the database rather than trusted from the client: this
-- is a priority list, and a priority list of forty things is not one.
--
-- Checking each element needs unnest, and a CHECK constraint may not contain
-- a subquery -- so the test lives in an immutable function, which a CHECK is
-- allowed to call.
create or replace function public.preferences_are_sane(p text[])
returns boolean
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select p is null
      or array_length(p, 1) is null
      or (
        array_length(p, 1) <= 12
        and (select bool_and(char_length(x) between 2 and 40) from unnest(p) as x)
      );
$$;

alter table public.profiles
  drop constraint if exists profiles_preferences_sane;
alter table public.profiles
  add constraint profiles_preferences_sane
  check (public.preferences_are_sane(preferences));
