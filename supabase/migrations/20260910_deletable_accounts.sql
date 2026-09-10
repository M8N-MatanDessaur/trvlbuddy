-- Let someone delete their account.
--
-- Six triggers keep the influence ledger, and every one of them writes a
-- reversal row when a contribution is deleted: delete a photo, insert
-- influence_events(recipient_id = the uploader, delta = -2). That is correct
-- when a person removes one photo. It is fatal when the person themselves is
-- being removed: deleting the profile cascades into their photos, videos,
-- likes and comments, each cascade fires its trigger, and each trigger tries
-- to insert a ledger row pointing at the profile that is on its way out. The
-- foreign key refuses it, the whole delete rolls back, and the account cannot
-- be deleted at all -- which for anyone who has ever posted a photograph
-- means there is no way off this app.
--
-- Rather than rewrite all six functions and hope the seventh remembers, the
-- ledger itself refuses to record anything for a recipient who no longer
-- exists. There is no meaning to "this person earned -2" once that person is
-- gone, the foreign key already says the row cannot exist, and this way any
-- future trigger inherits the rule for free.

create or replace function public.skip_influence_for_missing_recipient()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Returning null from a BEFORE INSERT row trigger drops the row quietly.
  -- The only case this catches is a recipient being deleted in the same
  -- transaction; a live recipient always passes.
  if new.recipient_id is null then
    return null;
  end if;
  if not exists (select 1 from public.profiles where id = new.recipient_id) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists influence_events_recipient_guard on public.influence_events;
create trigger influence_events_recipient_guard
  before insert on public.influence_events
  for each row
  execute function public.skip_influence_for_missing_recipient();
