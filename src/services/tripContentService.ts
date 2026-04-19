import { supabase } from '../lib/supabase';
import type { GeneratedActivity, Translation, EmergencyContact } from '../types/TravelData';

// Row shapes mirror the DB columns; we convert in/out of the frontend shapes.
interface TripActivityRow {
  id: string;
  trip_id: string;
  name: string;
  category: string | null;
  description: string | null;
  estimated_cost: string | null;
  duration: string | null;
  best_time: string | null;
  location: string | null;
  tips: string | null;
  difficulty: string | null;
  destination_id: string | null;
  city_id: string | null;
  google_place_id: string | null;
  db_activity_id: string | null;
  saved_by_ids: string[];
  created_at: string;
}

interface TripTranslationRow {
  id: string;
  trip_id: string;
  english: string;
  local: string;
  pronunciation: string | null;
  category: string | null;
  destination_id: string | null;
  city_id: string | null;
  created_at: string;
}

interface TripEmergencyRow {
  id: string;
  trip_id: string;
  name: string;
  number: string;
  description: string | null;
  type: string | null;
  destination_id: string | null;
  city_id: string | null;
  created_at: string;
}

function rowToActivity(r: TripActivityRow): GeneratedActivity {
  return {
    name: r.name,
    category: r.category ?? '',
    description: r.description ?? '',
    estimatedCost: r.estimated_cost ?? '',
    duration: r.duration ?? '',
    bestTime: r.best_time ?? '',
    location: r.location ?? '',
    tips: r.tips ?? '',
    difficulty: (r.difficulty as GeneratedActivity['difficulty']) ?? undefined,
    destinationId: r.destination_id ?? undefined,
    cityId: r.city_id ?? undefined,
    placeId: r.google_place_id ?? undefined,
    dbActivityId: r.db_activity_id ?? undefined,
  };
}

function activityToInsert(tripId: string, createdBy: string, a: GeneratedActivity) {
  return {
    trip_id: tripId,
    name: a.name,
    category: a.category || null,
    description: a.description || null,
    estimated_cost: a.estimatedCost || null,
    duration: a.duration || null,
    best_time: a.bestTime || null,
    location: a.location || null,
    tips: a.tips || null,
    difficulty: a.difficulty ?? null,
    destination_id: a.destinationId ?? null,
    city_id: a.cityId ?? null,
    google_place_id: a.placeId ?? null,
    db_activity_id: a.dbActivityId ?? null,
    created_by: createdBy,
  };
}

function rowToTranslation(r: TripTranslationRow): Translation {
  return {
    english: r.english,
    local: r.local,
    pronunciation: r.pronunciation ?? '',
    category: r.category ?? '',
    destinationId: r.destination_id ?? undefined,
    cityId: r.city_id ?? undefined,
  };
}

function translationToInsert(tripId: string, createdBy: string, t: Translation) {
  return {
    trip_id: tripId,
    english: t.english,
    local: t.local,
    pronunciation: t.pronunciation || null,
    category: t.category || null,
    destination_id: t.destinationId ?? null,
    city_id: t.cityId ?? null,
    created_by: createdBy,
  };
}

function rowToEmergency(r: TripEmergencyRow): EmergencyContact {
  return {
    name: r.name,
    number: r.number,
    description: r.description ?? '',
    type: (r.type as EmergencyContact['type']) ?? 'emergency',
    destinationId: r.destination_id ?? undefined,
    cityId: r.city_id ?? undefined,
  };
}

function emergencyToInsert(tripId: string, createdBy: string, c: EmergencyContact) {
  return {
    trip_id: tripId,
    name: c.name,
    number: c.number,
    description: c.description || null,
    type: c.type || null,
    destination_id: c.destinationId ?? null,
    city_id: c.cityId ?? null,
    created_by: createdBy,
  };
}

export async function listTripActivities(tripId: string): Promise<GeneratedActivity[]> {
  const { data, error } = await supabase
    .from('trip_activities')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('listTripActivities failed', error);
    return [];
  }
  return (data as TripActivityRow[]).map(rowToActivity);
}

export async function listTripTranslations(tripId: string): Promise<Translation[]> {
  const { data, error } = await supabase
    .from('trip_translations')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('listTripTranslations failed', error);
    return [];
  }
  return (data as TripTranslationRow[]).map(rowToTranslation);
}

export async function listTripEmergencyContacts(tripId: string): Promise<EmergencyContact[]> {
  const { data, error } = await supabase
    .from('trip_emergency_contacts')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('listTripEmergencyContacts failed', error);
    return [];
  }
  return (data as TripEmergencyRow[]).map(rowToEmergency);
}

// Replace all rows of a given trip-content table with the caller-supplied
// list. Used when generating content for the first time or fully regenerating
// a section. Individual row inserts/deletes from collaborators use the
// add-row helpers below.
export async function replaceTripActivities(
  tripId: string,
  createdBy: string,
  activities: GeneratedActivity[],
): Promise<void> {
  await supabase.from('trip_activities').delete().eq('trip_id', tripId);
  if (activities.length === 0) return;
  const rows = activities.map((a) => activityToInsert(tripId, createdBy, a));
  const { error } = await supabase.from('trip_activities').insert(rows);
  if (error) console.error('replaceTripActivities insert failed', error);
}

export async function replaceTripTranslations(
  tripId: string,
  createdBy: string,
  translations: Translation[],
): Promise<void> {
  await supabase.from('trip_translations').delete().eq('trip_id', tripId);
  if (translations.length === 0) return;
  const rows = translations.map((t) => translationToInsert(tripId, createdBy, t));
  const { error } = await supabase.from('trip_translations').insert(rows);
  if (error) console.error('replaceTripTranslations insert failed', error);
}

export async function replaceTripEmergencyContacts(
  tripId: string,
  createdBy: string,
  contacts: EmergencyContact[],
): Promise<void> {
  await supabase.from('trip_emergency_contacts').delete().eq('trip_id', tripId);
  if (contacts.length === 0) return;
  const rows = contacts.map((c) => emergencyToInsert(tripId, createdBy, c));
  const { error } = await supabase.from('trip_emergency_contacts').insert(rows);
  if (error) console.error('replaceTripEmergencyContacts insert failed', error);
}

export async function addTripActivity(tripId: string, createdBy: string, activity: GeneratedActivity): Promise<void> {
  const { error } = await supabase.from('trip_activities').insert(activityToInsert(tripId, createdBy, activity));
  if (error) console.error('addTripActivity failed', error);
}

export async function addTripTranslation(tripId: string, createdBy: string, translation: Translation): Promise<void> {
  const { error } = await supabase.from('trip_translations').insert(translationToInsert(tripId, createdBy, translation));
  if (error) console.error('addTripTranslation failed', error);
}
