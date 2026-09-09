import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// 'email' is omitted deliberately: the column privilege is revoked for anon
// and authenticated, so the browser never receives it. Read your own address
// from the auth session (useAuth().user.email) instead.
export type Profile = Omit<Database['public']['Tables']['profiles']['Row'], 'email'>;

// Every column of profiles the browser is allowed to read. `email` is
// deliberately absent: the column privilege is revoked for anon and
// authenticated (see 20260909_ai_quota_and_email_privacy.sql) because the
// read policy is `using (true)`, so a select('*') here would hand every
// user's address to anyone holding the anon key. Read your own address from
// the auth session instead, never from this table.
export const PROFILE_COLUMNS =
  'id, display_name, avatar_url, influence, onboarded_at, created_at, current_trip_id, theme';
export type Activity = Database['public']['Tables']['activities']['Row'];
export type ActivityImage = Database['public']['Tables']['activity_images']['Row'];
export type ActivityImageLike = Database['public']['Tables']['activity_image_likes']['Row'];
export type ActivityImageComment = Database['public']['Tables']['activity_image_comments']['Row'];
export type ActivityVote = Database['public']['Tables']['activity_votes']['Row'];
export type ActivityVoteScore = Database['public']['Views']['activity_vote_scores']['Row'];
export type Trip = Database['public']['Tables']['trips']['Row'];
export type TripInsert = Database['public']['Tables']['trips']['Insert'];
export type TripUpdate = Database['public']['Tables']['trips']['Update'];
export type TripMember = Database['public']['Tables']['trip_members']['Row'];
export type TripActivity = Database['public']['Tables']['trip_activities']['Row'];
export type TripActivityInsert = Database['public']['Tables']['trip_activities']['Insert'];
export type TripTranslation = Database['public']['Tables']['trip_translations']['Row'];
export type TripTranslationInsert = Database['public']['Tables']['trip_translations']['Insert'];
export type TripEmergencyContact = Database['public']['Tables']['trip_emergency_contacts']['Row'];
export type TripEmergencyContactInsert = Database['public']['Tables']['trip_emergency_contacts']['Insert'];

export const ACTIVITY_IMAGES_BUCKET = 'activity-images';

export function publicImageUrl(storagePath: string): string {
  return supabase.storage.from(ACTIVITY_IMAGES_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}
