-- ---------------------------------------------------------------------------
-- The trip checklist
-- ---------------------------------------------------------------------------
--
-- A trip is shared: several people are on the same one, looking at the same
-- list. So "we did this" belongs on the trip row, not in one person's
-- browser -- if one of you ticks the market off, everyone should see it
-- ticked.
--
-- Two columns rather than a join table: this is one fact per activity, and
-- who did the ticking is worth keeping so the list can say "Sara ticked this
-- off" rather than pretending it happened by itself.
--
-- done_at doubles as the flag and the timestamp. A null means not done, which
-- is the only state that needs no explanation.

alter table public.trip_activities
  add column if not exists done_at timestamptz,
  add column if not exists done_by uuid references auth.users(id) on delete set null;

comment on column public.trip_activities.done_at is
  'When somebody on this trip ticked this activity off. Null means still to do. Shared across trip members on purpose.';
comment on column public.trip_activities.done_by is
  'Who ticked it off, so the list can say who did rather than implying it did itself.';

-- Reading a trip's list nearly always wants the outstanding ones first, and
-- the index keeps that cheap once a long trip accumulates.
create index if not exists trip_activities_done_idx
  on public.trip_activities (trip_id, done_at);

-- The existing UPDATE policy already restricts writes to trip members, which
-- is exactly the rule wanted here: anyone on the trip may tick anything off,
-- because they are doing it together. No policy change needed -- verified
-- rather than assumed.
