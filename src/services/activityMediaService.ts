import { supabase, publicImageUrl, type Activity, type ActivityImage } from '../lib/supabase';
import { compressForUpload } from '../lib/imageCompress';
import { computeThumbhashFromFile } from '../lib/thumbhash';

export interface PosterProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface ActivityVoteState {
  score: number;
  upvotes: number;
  downvotes: number;
  myVote: 0 | 1 | -1;
}

export const ZERO_VOTE_STATE: ActivityVoteState = { score: 0, upvotes: 0, downvotes: 0, myVote: 0 };

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
  poster: PosterProfile | null;
}

export interface ActivityImageComment {
  id: string;
  image_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  parent_comment_id: string | null;
}

export async function ensureActivity(key: ActivityKey, createdBy: string | null): Promise<Activity | null> {
  const slug = computeSlug(key);

  const { data: existing } = await supabase
    .from('activities')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) {
    // Backfill lat/lng/place_id on rows that pre-date enrichment so the Map
    // tab gets coords for trips planned before this column existed.
    const updates: Record<string, unknown> = {};
    if (existing.lat == null && key.lat != null) updates.lat = key.lat;
    if (existing.lng == null && key.lng != null) updates.lng = key.lng;
    if (!existing.google_place_id && key.googlePlaceId) updates.google_place_id = key.googlePlaceId;
    if (Object.keys(updates).length > 0) {
      await supabase.from('activities').update(updates).eq('id', existing.id);
      return { ...existing, ...updates } as Activity;
    }
    return existing;
  }

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
  const uploaderIds = Array.from(new Set(data.map((row) => row.uploaded_by).filter(Boolean)));
  const likeCounts = new Map<string, number>();
  const commentCounts = new Map<string, number>();
  const likedByViewer = new Set<string>();
  const posters = new Map<string, PosterProfile>();

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
      .select('image_id, deleted_at')
      .in('image_id', imageIds);

    comments?.forEach((comment) => {
      if (comment.deleted_at) return;
      commentCounts.set(comment.image_id, (commentCounts.get(comment.image_id) || 0) + 1);
    });
  }

  if (uploaderIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', uploaderIds);
    profiles?.forEach((row) => posters.set(row.id, row));
  }

  return data.map((row) => ({
    ...row,
    url: publicImageUrl(row.storage_path),
    likeCount: likeCounts.get(row.id) || 0,
    likedByViewer: likedByViewer.has(row.id),
    commentCount: commentCounts.get(row.id) || 0,
    poster: posters.get(row.uploaded_by) || null,
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
  const { activityId, uploaderId } = params;

  // Compress + compute thumbhash from the ORIGINAL file (before recompression)
  // so the placeholder matches the true image colors. Run in parallel — the
  // compression is the long pole, the hash takes <50ms.
  const [{ file: compressed }, thumbhash] = await Promise.all([
    compressForUpload(params.file),
    computeThumbhashFromFile(params.file),
  ]);

  const ext = (compressed.name.split('.').pop() || 'webp').toLowerCase();
  const safeExt = /^(jpg|jpeg|png|webp|heic|heif)$/.test(ext) ? ext : 'webp';
  const path = `${activityId}/${uploaderId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

  // Storage paths embed a random suffix and are never reused, so the bytes at
  // a given path are effectively immutable. Cache for a year so the browser
  // and CDN can avoid re-fetching them on every session.
  const { error: uploadError } = await supabase.storage
    .from('activity-images')
    .upload(path, compressed, {
      cacheControl: '31536000',
      upsert: false,
      contentType: compressed.type || `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`,
    });

  if (uploadError) return { image: null, error: uploadError.message };

  const { data: row, error: rowError } = await supabase
    .from('activity_images')
    .insert({
      activity_id: activityId,
      uploaded_by: uploaderId,
      storage_path: path,
      thumbhash: thumbhash ?? null,
    })
    .select('*')
    .maybeSingle();

  if (rowError) {
    await supabase.storage.from('activity-images').remove([path]);
    return { image: null, error: rowError.message };
  }

  if (!row) return { image: null, error: 'Could not save image' };

  const { data: posterRow } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .eq('id', uploaderId)
    .maybeSingle();

  return {
    image: {
      ...row,
      url: publicImageUrl(path),
      likeCount: 0,
      likedByViewer: false,
      commentCount: 0,
      poster: posterRow ?? null,
    },
    error: null,
  };
}

export async function getActivityVoteState(
  activityId: string,
  viewerId?: string | null,
): Promise<ActivityVoteState> {
  const [{ data: scoreRow }, viewerVote] = await Promise.all([
    supabase
      .from('activity_vote_scores')
      .select('score, upvotes, downvotes')
      .eq('activity_id', activityId)
      .maybeSingle(),
    viewerId
      ? supabase
          .from('activity_votes')
          .select('value')
          .eq('activity_id', activityId)
          .eq('user_id', viewerId)
          .maybeSingle()
          .then(({ data }) => (data?.value === 1 || data?.value === -1 ? data.value : 0))
      : Promise.resolve(0 as 0 | 1 | -1),
  ]);

  return {
    score: scoreRow?.score ?? 0,
    upvotes: scoreRow?.upvotes ?? 0,
    downvotes: scoreRow?.downvotes ?? 0,
    myVote: (viewerVote ?? 0) as 0 | 1 | -1,
  };
}

export async function setActivityVote(params: {
  activityId: string;
  userId: string;
  value: 0 | 1 | -1;
}): Promise<{ error: string | null }> {
  const { activityId, userId, value } = params;

  if (value === 0) {
    const { error } = await supabase
      .from('activity_votes')
      .delete()
      .eq('activity_id', activityId)
      .eq('user_id', userId);
    return { error: error?.message ?? null };
  }

  const { error } = await supabase
    .from('activity_votes')
    .upsert(
      { activity_id: activityId, user_id: userId, value },
      { onConflict: 'activity_id,user_id' },
    );
  return { error: error?.message ?? null };
}

export interface UserPhoto {
  id: string;
  url: string;
  storage_path: string;
  thumbhash: string | null;
  created_at: string;
  activity_id: string;
  activity_name: string;
  activity_slug: string;
  activity_address: string | null;
  google_place_id: string | null;
  google_maps_url: string | null;
  likeCount: number;
  commentCount: number;
}

export async function listUserPhotos(userId: string): Promise<UserPhoto[]> {
  const { data: rows } = await supabase
    .from('activity_images')
    .select('id, storage_path, thumbhash, created_at, activity_id, activities!inner(name, slug, address, google_place_id, google_maps_url)')
    .eq('uploaded_by', userId)
    .order('created_at', { ascending: false });

  if (!rows || rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const likeCounts = new Map<string, number>();
  const commentCounts = new Map<string, number>();

  const [{ data: likes }, { data: comments }] = await Promise.all([
    supabase.from('activity_image_likes').select('image_id').in('image_id', ids),
    supabase.from('activity_image_comments').select('image_id, deleted_at').in('image_id', ids),
  ]);

  likes?.forEach((row) => {
    likeCounts.set(row.image_id, (likeCounts.get(row.image_id) || 0) + 1);
  });
  comments?.forEach((row) => {
    if (row.deleted_at) return;
    commentCounts.set(row.image_id, (commentCounts.get(row.image_id) || 0) + 1);
  });

  return rows.map((row) => {
    const activity = (row as unknown as { activities: { name: string; slug: string; address: string | null; google_place_id: string | null; google_maps_url: string | null } }).activities;
    return {
      id: row.id,
      storage_path: row.storage_path,
      thumbhash: row.thumbhash ?? null,
      created_at: row.created_at,
      activity_id: row.activity_id,
      activity_name: activity.name,
      activity_slug: activity.slug,
      activity_address: activity.address,
      google_place_id: activity.google_place_id,
      google_maps_url: activity.google_maps_url,
      url: publicImageUrl(row.storage_path),
      likeCount: likeCounts.get(row.id) || 0,
      commentCount: commentCounts.get(row.id) || 0,
    };
  });
}

// Per-user "I did this" tracker for activities. The map / home dashboard /
// explore card all read from this.

export async function listMyCompletedActivityIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('activity_completions')
    .select('activity_id')
    .eq('user_id', userId);
  return new Set((data || []).map((row) => row.activity_id).filter(Boolean));
}

export async function setActivityCompleted(params: {
  userId: string;
  activityId: string;
  completed: boolean;
}): Promise<{ error: string | null }> {
  const { userId, activityId, completed } = params;
  if (completed) {
    const { error } = await supabase
      .from('activity_completions')
      .upsert(
        { user_id: userId, activity_id: activityId },
        { onConflict: 'user_id,activity_id', ignoreDuplicates: true },
      );
    return { error: error?.message ?? null };
  }
  const { error } = await supabase
    .from('activity_completions')
    .delete()
    .eq('user_id', userId)
    .eq('activity_id', activityId);
  return { error: error?.message ?? null };
}

export interface UserSocialStats {
  postCount: number;
  likesReceived: number;
  commentsReceived: number;
}

export async function getUserSocialStats(userId: string): Promise<UserSocialStats> {
  const { data: imageRows } = await supabase
    .from('activity_images')
    .select('id')
    .eq('uploaded_by', userId);

  const imageIds = (imageRows || []).map((row) => row.id);
  const postCount = imageIds.length;

  if (postCount === 0) {
    return { postCount: 0, likesReceived: 0, commentsReceived: 0 };
  }

  const [{ count: likeCount }, { count: commentCount }] = await Promise.all([
    supabase
      .from('activity_image_likes')
      .select('image_id', { count: 'exact', head: true })
      .in('image_id', imageIds),
    supabase
      .from('activity_image_comments')
      .select('image_id', { count: 'exact', head: true })
      .in('image_id', imageIds)
      .is('deleted_at', null),
  ]);

  return {
    postCount,
    likesReceived: likeCount ?? 0,
    commentsReceived: commentCount ?? 0,
  };
}

export async function getActivityScoresBySlug(
  slugs: string[],
): Promise<Map<string, { activityId: string; score: number }>> {
  const out = new Map<string, { activityId: string; score: number }>();
  if (slugs.length === 0) return out;

  const { data: activities } = await supabase
    .from('activities')
    .select('id, slug')
    .in('slug', slugs);

  if (!activities || activities.length === 0) return out;

  const ids = activities.map((row) => row.id);
  const { data: scores } = await supabase
    .from('activity_vote_scores')
    .select('activity_id, score')
    .in('activity_id', ids);

  const scoreById = new Map(scores?.map((row) => [row.activity_id ?? '', row.score ?? 0]) ?? []);
  activities.forEach((row) => {
    out.set(row.slug, { activityId: row.id, score: scoreById.get(row.id) ?? 0 });
  });
  return out;
}

export async function deleteActivityImage(params: {
  imageId: string;
  userId: string;
  storagePath: string;
}): Promise<{ error: string | null }> {
  const { imageId, userId, storagePath } = params;

  const { error } = await supabase
    .from('activity_images')
    .delete()
    .eq('id', imageId)
    .eq('uploaded_by', userId);
  if (error) return { error: error.message };

  // Storage object cleanup is best-effort; the row delete is the source of truth.
  try {
    await supabase.storage.from('activity-images').remove([storagePath]);
  } catch (storageErr) {
    console.warn('failed to remove storage object', storageErr);
  }

  return { error: null };
}

export async function isImageLikedByViewer(imageId: string, viewerId: string): Promise<boolean> {
  const { data } = await supabase
    .from('activity_image_likes')
    .select('image_id')
    .eq('image_id', imageId)
    .eq('user_id', viewerId)
    .maybeSingle();
  return !!data;
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
    .select('id, image_id, user_id, body, created_at, updated_at, deleted_at, parent_comment_id')
    .eq('image_id', imageId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data;
}

export async function addActivityImageComment(params: {
  imageId: string;
  userId: string;
  body: string;
  parentCommentId?: string | null;
}): Promise<{ comment: ActivityImageComment | null; error: string | null }> {
  const body = params.body.trim();
  if (!body) return { comment: null, error: 'Comment cannot be empty' };

  const { data, error } = await supabase
    .from('activity_image_comments')
    .insert({
      image_id: params.imageId,
      user_id: params.userId,
      body,
      parent_comment_id: params.parentCommentId ?? null,
    })
    .select('id, image_id, user_id, body, created_at, updated_at, deleted_at, parent_comment_id')
    .maybeSingle();

  return {
    comment: data ?? null,
    error: error?.message ?? null,
  };
}

export async function updateActivityImageComment(params: {
  commentId: string;
  userId: string;
  body: string;
}): Promise<{ comment: ActivityImageComment | null; error: string | null }> {
  const body = params.body.trim();
  if (!body) return { comment: null, error: 'Comment cannot be empty' };

  const { data, error } = await supabase
    .from('activity_image_comments')
    .update({ body })
    .eq('id', params.commentId)
    .eq('user_id', params.userId)
    .is('deleted_at', null)
    .select('id, image_id, user_id, body, created_at, updated_at, deleted_at, parent_comment_id')
    .maybeSingle();

  return {
    comment: data ?? null,
    error: error?.message ?? null,
  };
}

export async function deleteActivityImageComment(params: {
  commentId: string;
  userId: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('activity_image_comments')
    .update({
      body: 'This comment was deleted.',
      deleted_at: new Date().toISOString(),
    })
    .eq('id', params.commentId)
    .eq('user_id', params.userId)
    .is('deleted_at', null);

  return { error: error?.message ?? null };
}
