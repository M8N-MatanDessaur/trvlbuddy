import { supabase, publicImageUrl, type Activity } from '../lib/supabase';

export interface ActivityKey {
  name: string;
  city?: string | null;
  address?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  website?: string | null;
  googleMapsUrl?: string | null;
  googlePlaceId?: string | null;
}

function normalize(s: string | null | undefined): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function computeSlug(key: ActivityKey): string {
  if (key.googlePlaceId) return `gpid-${key.googlePlaceId}`;
  const parts = [key.name, key.city, key.address].filter(Boolean).map(normalize).filter(Boolean);
  return parts.join('--') || `unknown-${Date.now()}`;
}

export async function ensureActivity(key: ActivityKey, createdBy: string | null): Promise<Activity | null> {
  const slug = computeSlug(key);

  const { data: existing } = await supabase
    .from('activities')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) return existing;

  const insertRow = {
    slug,
    name: key.name,
    address: key.address ?? null,
    city: key.city ?? null,
    country: key.country ?? null,
    lat: key.lat ?? null,
    lng: key.lng ?? null,
    website: key.website ?? null,
    google_maps_url: key.googleMapsUrl ?? null,
    google_place_id: key.googlePlaceId ?? null,
    created_by: createdBy,
  };

  const { data: inserted, error } = await supabase
    .from('activities')
    .insert(insertRow)
    .select('*')
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      const { data: retry } = await supabase.from('activities').select('*').eq('slug', slug).maybeSingle();
      return retry;
    }
    console.error('ensureActivity failed', error);
    return null;
  }
  return inserted;
}

export async function listActivityImageUrls(activityId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('activity_images')
    .select('storage_path, created_at')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((row) => publicImageUrl(row.storage_path));
}

export async function uploadActivityImage(params: {
  activityId: string;
  uploaderId: string;
  file: File;
}): Promise<{ url: string | null; error: string | null }> {
  const { activityId, uploaderId, file } = params;

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeExt = /^(jpg|jpeg|png|webp|heic|heif)$/.test(ext) ? ext : 'jpg';
  const path = `${activityId}/${uploaderId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

  const { error: uploadError } = await supabase.storage
    .from('activity-images')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`,
    });

  if (uploadError) return { url: null, error: uploadError.message };

  const { error: rowError } = await supabase
    .from('activity_images')
    .insert({
      activity_id: activityId,
      uploaded_by: uploaderId,
      storage_path: path,
    });

  if (rowError) {
    await supabase.storage.from('activity-images').remove([path]);
    return { url: null, error: rowError.message };
  }

  return { url: publicImageUrl(path), error: null };
}
