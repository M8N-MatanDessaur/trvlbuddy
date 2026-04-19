import { supabase, type Trip, type TripInsert } from '../lib/supabase';
import type { TravelPlan, GeneratedActivity, Translation, EmergencyContact, JournalEntry } from '../types/TravelData';

export interface TripPlanBundle {
  currentPlan: TravelPlan;
  activities: GeneratedActivity[];
  translations: Translation[];
  emergencyContacts: EmergencyContact[];
  savedActivities: string[];
  journalEntries: JournalEntry[];
}

export interface SavedTripRow extends Trip {
  plan: TripPlanBundle;
}

function cityNames(plan: TravelPlan): string[] {
  const fromSegments = plan.segments?.map((s) => s.city?.name || s.destination?.name).filter(Boolean) as string[] | undefined;
  if (fromSegments && fromSegments.length) return fromSegments;
  const fromDests = plan.destinations?.map((d) => d.name) || [];
  if (fromDests.length) return fromDests;
  return plan.destination?.name ? [plan.destination.name] : [];
}

export async function saveTrip(params: {
  ownerId: string;
  bundle: TripPlanBundle;
  existingTripId?: string | null;
}): Promise<{ data: Trip | null; error: string | null }> {
  const { ownerId, bundle, existingTripId } = params;
  const plan = bundle.currentPlan;

  const row: TripInsert = {
    owner_id: ownerId,
    title: plan.title || 'Untitled trip',
    cities: cityNames(plan),
    start_date: plan.startDate || null,
    end_date: plan.endDate || null,
    plan: bundle as unknown as TripInsert['plan'],
    visibility: 'private',
  };

  let data: Trip | null = null;
  let errorMsg: string | null = null;

  if (existingTripId) {
    const res = await supabase
      .from('trips')
      .update(row)
      .eq('id', existingTripId)
      .select('*')
      .maybeSingle();
    data = res.data;
    errorMsg = res.error?.message ?? null;
  } else {
    const res = await supabase
      .from('trips')
      .insert(row)
      .select('*')
      .maybeSingle();
    data = res.data;
    errorMsg = res.error?.message ?? null;
  }

  // Mirror the per-item content into the collaborative tables so other
  // members see it. Fire-and-forget -- failures just mean the JSONB plan is
  // still the source of truth for this trip.
  if (data && !errorMsg) {
    try {
      const { replaceTripActivities, replaceTripTranslations, replaceTripEmergencyContacts } =
        await import('./tripContentService');
      await Promise.all([
        replaceTripActivities(data.id, ownerId, bundle.activities || []),
        replaceTripTranslations(data.id, ownerId, bundle.translations || []),
        replaceTripEmergencyContacts(data.id, ownerId, bundle.emergencyContacts || []),
      ]);
      await supabase.from('profiles').update({ current_trip_id: data.id }).eq('id', ownerId);
    } catch (err) {
      console.error('trip content mirror failed', err);
    }
  }

  return { data, error: errorMsg };
}

export async function listMyTrips(ownerId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('listMyTrips failed', error);
    return [];
  }
  return data || [];
}

export async function loadTrip(tripId: string): Promise<SavedTripRow | null> {
  const { data, error } = await supabase.from('trips').select('*').eq('id', tripId).maybeSingle();
  if (error || !data) return null;
  return data as SavedTripRow;
}

export async function deleteTrip(tripId: string, ownerId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('trips').delete().eq('id', tripId).eq('owner_id', ownerId);
  return { error: error?.message ?? null };
}
