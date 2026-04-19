import { supabase, publicImageUrl, type Activity, type ActivityImage } from '../lib/supabase';

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

export interface ActivityImageMedia extends ActivityImage {
  url: string;
  likeCount: number;
  likedByViewer: boolean;
  commentCount: number;
}

export interface ActivityImageComment {
  id: string;
  image_id: string;
  user_id: string;
  body: string;
  created_at: string;
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

export async function listActivityImages(
  activityId: string,
  viewerId?: string | null,
): Promise<ActivityImageMedia[]> {
  const { data, error } = await supabase
    .from('activity_images')
    .select('*')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];

  const imageIds = data.map((row) => row.id);
  const likeCounts = new Map<string, number>();
  const commentCounts = new Map<string, number>();
  const likedByViewer = new Set<string>();

  if (imageIds.length > 0) {
    const { data: likes } = await supabase
      .from('activity_image_likes')
      .select('image_id, user_id')
      .in('image_id', imageIds);

    likes?.forEach((like) => {
      likeCounts.set(like.image_id, (likeCounts.get(like.image_id) || 0) + 1);
      if (viewerId && like.user_id === viewerId) {
        likedByViewer.add(like.image_id);
      }
    });

    const { data: comments } = await supabase
      .from('activity_image_comments')
      .select('image_id')
      .in('image_id', imageIds);

    comments?.forEach((comment) => {
      commentCounts.set(comment.image_id, (commentCounts.get(comment.image_id) || 0) + 1);
    });
  }

  return data.map((row) => ({
    ...row,
    url: publicImageUrl(row.storage_path),
    likeCount: likeCounts.get(row.id) || 0,
    likedByViewer: likedByViewer.has(row.id),
    commentCount: commentCounts.get(row.id) || 0,
  }));
}

export async function listActivityImageUrls(activityId: string): Promise<string[]> {
  const images = await listActivityImages(activityId);
  return images.map((image) => image.url);
}

export async function uploadActivityImage(params: {
  activityId: string;
  uploaderId: string;
  file: File;
}): Promise<{ image: ActivityImageMedia | null; error: string | null }> {
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

  if (uploadError) return { image: null, error: uploadError.message };

  const { data: row, error: rowError } = await supabase
    .from('activity_images')
    .insert({
      activity_id: activityId,
      uploaded_by: uploaderId,
      storage_path: path,
    })
    .select('*')
    .maybeSingle();

  if (rowError) {
    await supabase.storage.from('activity-images').remove([path]);
    return { image: null, error: rowError.message };
  }

  if (!row) return { image: null, error: 'Could not save image' };

  return {
    image: {
      ...row,
      url: publicImageUrl(path),
      likeCount: 0,
      likedByViewer: false,
      commentCount: 0,
    },
    error: null,
  };
}

export async function setActivityImageLiked(params: {
  imageId: string;
  userId: string;
  liked: boolean;
}): Promise<{ error: string | null }> {
  const { imageId, userId, liked } = params;

  if (liked) {
    const { error } = await supabase
      .from('activity_image_likes')
      .upsert(
        { image_id: imageId, user_id: userId },
        { onConflict: 'image_id,user_id', ignoreDuplicates: true },
      );
    return { error: error?.message ?? null };
  }

  const { error } = await supabase
    .from('activity_image_likes')
    .delete()
    .eq('image_id', imageId)
    .eq('user_id', userId);

  return { error: error?.message ?? null };
}

export async function listActivityImageComments(imageId: string): Promise<ActivityImageComment[]> {
  const { data, error } = await supabase
    .from('activity_image_comments')
    .select('id, image_id, user_id, body, created_at')
    .eq('image_id', imageId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data;
}

export async function addActivityImageComment(params: {
  imageId: string;
  userId: string;
  body: string;
}): Promise<{ comment: ActivityImageComment | null; error: string | null }> {
  const body = params.body.trim();
  if (!body) return { comment: null, error: 'Comment cannot be empty' };

  const { data, error } = await supabase
    .from('activity_image_comments')
    .insert({
      image_id: params.imageId,
      user_id: params.userId,
      body,
    })
    .select('id, image_id, user_id, body, created_at')
    .maybeSingle();

  return {
    comment: data ?? null,
    error: error?.message ?? null,
  };
}
