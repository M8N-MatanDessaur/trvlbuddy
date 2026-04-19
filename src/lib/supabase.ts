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

export type Profile = Database['public']['Tables']['profiles']['Row'];
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
