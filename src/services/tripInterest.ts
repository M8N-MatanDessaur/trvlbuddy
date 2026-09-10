import { supabase } from '../lib/supabase';

/**
 * Who is coming to what, on a shared trip.
 *
 * Saying you are in is both the vote and the answer to "who is going", they
 * are the same gesture, and splitting them would let someone vote for a thing
 * they have no intention of turning up to.
 *
 * Nobody is counted against the group: a person who has not answered has no
 * row, and the plan says "3 in" rather than "3 of 5", because half the point
 * of planning together is that people answer whenever they get to it.
 */
export type Interest = 'in' | 'out';

export interface Attendee {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  state: Interest;
}

export interface ActivityInterest {
  /** Everyone who has said either way, in the order they answered. */
  attendees: Attendee[];
  in: Attendee[];
  out: Attendee[];
  /** What you said, if anything. */
  mine: Interest | null;
}

interface Row {
  trip_activity_id: string;
  user_id: string;
  state: Interest;
  created_at: string;
  person: { id: string; display_name: string | null; avatar_url: string | null } | null;
}

const EMPTY: ActivityInterest = { attendees: [], in: [], out: [], mine: null };

/**
 * Who is coming to everything on this trip, in one query.
 *
 * A screen of plan items should not be a query per item, and the answer
 * changes as people reply, so this returns the whole picture at once.
 */
export async function interestForTrip(
  activityIds: string[],
  viewerId?: string | null,
): Promise<Map<string, ActivityInterest>> {
  const out = new Map<string, ActivityInterest>();
  if (activityIds.length === 0) return out;

  const { data, error } = await supabase
    .from('trip_activity_interest')
    .select(
      'trip_activity_id, user_id, state, created_at,'
        + ' person:profiles!trip_activity_interest_user_id_fkey(id, display_name, avatar_url)',
    )
    .in('trip_activity_id', activityIds)
    .order('created_at', { ascending: true });

  if (error || !data) return out;

  for (const row of data as unknown as Row[]) {
    let entry = out.get(row.trip_activity_id);
    if (!entry) {
      entry = { attendees: [], in: [], out: [], mine: null };
      out.set(row.trip_activity_id, entry);
    }
    const attendee: Attendee = {
      id: row.user_id,
      name: row.person?.display_name ?? null,
      avatarUrl: row.person?.avatar_url ?? null,
      state: row.state,
    };
    entry.attendees.push(attendee);
    if (row.state === 'in') entry.in.push(attendee);
    else entry.out.push(attendee);
    if (viewerId && row.user_id === viewerId) entry.mine = row.state;
  }

  return out;
}

/** What one activity looks like when nobody has answered. */
export function noInterest(): ActivityInterest {
  return { ...EMPTY, attendees: [], in: [], out: [] };
}

/**
 * Say whether you are coming, change your mind, or take it back.
 *
 * Passing null withdraws entirely, which is a different statement from "out":
 * one is "not for me", the other is "ignore me on this one".
 */
export async function setInterest(params: {
  activityId: string;
  userId: string;
  state: Interest | null;
}): Promise<boolean> {
  if (params.state === null) {
    const { error } = await supabase
      .from('trip_activity_interest')
      .delete()
      .eq('trip_activity_id', params.activityId)
      .eq('user_id', params.userId);
    return !error;
  }

  const { error } = await supabase
    .from('trip_activity_interest')
    .upsert(
      {
        trip_activity_id: params.activityId,
        user_id: params.userId,
        state: params.state,
      },
      { onConflict: 'trip_activity_id,user_id' },
    );
  return !error;
}

/** "3 in", "2 in, 1 out", or nothing at all when nobody has said. */
export function describeInterest(entry: ActivityInterest | undefined | null): string | null {
  if (!entry || entry.attendees.length === 0) return null;
  const parts: string[] = [];
  if (entry.in.length > 0) parts.push(`${entry.in.length} in`);
  if (entry.out.length > 0) parts.push(`${entry.out.length} out`);
  return parts.join(', ');
}
