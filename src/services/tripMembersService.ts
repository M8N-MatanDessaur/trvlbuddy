import { supabase, type Profile, type TripMember } from '../lib/supabase';

export interface TripMemberWithProfile extends TripMember {
  profile: Profile | null;
}

export async function listTripMembers(tripId: string): Promise<TripMemberWithProfile[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('trip_id, user_id, role, joined_at, profiles:profiles!trip_members_user_id_fkey(*)')
    .eq('trip_id', tripId)
    .order('joined_at', { ascending: true });
  if (error) {
    console.error('listTripMembers failed', error);
    return [];
  }
  type Raw = {
    trip_id: string;
    user_id: string;
    role: string;
    joined_at: string;
    profiles: Profile | null;
  };
  return (data as Raw[] | null ?? []).map((row) => ({
    trip_id: row.trip_id,
    user_id: row.user_id,
    role: row.role,
    joined_at: row.joined_at,
    profile: row.profiles,
  }));
}

export async function joinTripByToken(token: string): Promise<string | null> {
  const clean = token.trim().toLowerCase();
  if (!clean) return null;
  const { data, error } = await supabase.rpc('join_trip', { p_token: clean });
  if (error) {
    console.error('joinTripByToken failed', error);
    return null;
  }
  return (data as string | null) ?? null;
}

export async function leaveTrip(tripId: string, userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId);
  return { error: error?.message ?? null };
}

export async function setCurrentTrip(userId: string, tripId: string | null): Promise<void> {
  await supabase.from('profiles').update({ current_trip_id: tripId }).eq('id', userId);
}
