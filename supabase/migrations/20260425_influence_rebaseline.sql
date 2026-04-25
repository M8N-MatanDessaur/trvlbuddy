-- Optional one-shot: rebaseline profiles.influence from the authoritative
-- influence_events table. Run this after 20260424_influence_events.sql
-- if you want historical scores to reflect the v1 scoring weights
-- instead of the old +1-per-like model.
--
-- Idempotent — running it twice produces the same result. New events
-- keep streaming in live; this just aligns the denormalized column with
-- whatever the ledger currently sums to.

update public.profiles p
set influence = coalesce(sub.total, 0)
from (
  select recipient_id, sum(delta)::int as total
  from public.influence_events
  group by recipient_id
) sub
where sub.recipient_id = p.id;

-- Zero out users who have never received an event so the column doesn't
-- carry stale numbers from the legacy trigger.
update public.profiles p
set influence = 0
where not exists (
  select 1 from public.influence_events e where e.recipient_id = p.id
);
