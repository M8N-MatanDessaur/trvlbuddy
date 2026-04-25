import { supabase, publicImageUrl } from '../lib/supabase';
import { computeThumbhashFromFile } from '../lib/thumbhash';

export interface ActivityVideoMedia {
  id: string;
  activity_id: string;
  uploaded_by: string;
  storage_path: string;
  poster_path: string;
  thumbhash: string | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
  url: string;
  posterUrl: string;
  likeCount: number;
  likedByViewer: boolean;
  commentCount: number;
}

function publicVideoUrl(path: string): string {
  const { data } = supabase.storage.from('activity-videos').getPublicUrl(path);
  return data.publicUrl;
}

export async function listActivityVideos(
  activityId: string,
  viewerId?: string | null,
): Promise<ActivityVideoMedia[]> {
  const { data } = await supabase
    .from('activity_videos')
    .select('*')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: false });
  if (!data) return [];

  const ids = data.map((r) => r.id);
  const likeCounts = new Map<string, number>();
  const commentCounts = new Map<string, number>();
  const likedByViewer = new Set<string>();

  if (ids.length > 0) {
    const { data: likes } = await supabase
      .from('activity_video_likes')
      .select('video_id, user_id')
      .in('video_id', ids);
    likes?.forEach((l) => {
      likeCounts.set(l.video_id, (likeCounts.get(l.video_id) || 0) + 1);
      if (viewerId && l.user_id === viewerId) likedByViewer.add(l.video_id);
    });

    const { data: comments } = await supabase
      .from('activity_video_comments')
      .select('video_id, deleted_at')
      .in('video_id', ids);
    comments?.forEach((c) => {
      if (c.deleted_at) return;
      commentCounts.set(c.video_id, (commentCounts.get(c.video_id) || 0) + 1);
    });
  }

  return data.map((row) => ({
    ...row,
    url: publicVideoUrl(row.storage_path),
    posterUrl: publicImageUrl(row.poster_path),
    likeCount: likeCounts.get(row.id) || 0,
    likedByViewer: likedByViewer.has(row.id),
    commentCount: commentCounts.get(row.id) || 0,
  }));
}

export interface UploadActivityVideoParams {
  activityId: string;
  uploaderId: string;
  video: File;
  poster: File;
  durationMs: number;
  width: number;
  height: number;
}

// Uploads both the transcoded video AND its extracted poster frame in
// parallel, computes a thumbhash from the poster for the placeholder,
// then writes the activity_videos row pointing at both storage paths.
export async function uploadActivityVideo(
  params: UploadActivityVideoParams,
): Promise<{ video: ActivityVideoMedia | null; error: string | null }> {
  const { activityId, uploaderId, video, poster, durationMs, width, height } = params;

  const ts = Date.now();
  const stub = `${uploaderId}-${ts}-${Math.random().toString(36).slice(2, 8)}`;
  const videoPath = `${activityId}/${stub}.mp4`;
  const posterPath = `${activityId}/${stub}.jpg`;

  const [videoRes, posterRes, thumbhash] = await Promise.all([
    supabase.storage.from('activity-videos').upload(videoPath, video, {
      cacheControl: '31536000',
      upsert: false,
      contentType: 'video/mp4',
    }),
    // Posters live in the existing activity-images bucket so the same
    // CDN cache + RLS + image pipeline handles them.
    supabase.storage.from('activity-images').upload(posterPath, poster, {
      cacheControl: '31536000',
      upsert: false,
      contentType: 'image/jpeg',
    }),
    computeThumbhashFromFile(poster),
  ]);

  if (videoRes.error) return { video: null, error: videoRes.error.message };
  if (posterRes.error) {
    await supabase.storage.from('activity-videos').remove([videoPath]).catch(() => {});
    return { video: null, error: posterRes.error.message };
  }

  const { data: row, error: rowError } = await supabase
    .from('activity_videos')
    .insert({
      activity_id: activityId,
      uploaded_by: uploaderId,
      storage_path: videoPath,
      poster_path: posterPath,
      thumbhash: thumbhash ?? null,
      duration_ms: durationMs,
      width,
      height,
    })
    .select('*')
    .maybeSingle();

  if (rowError || !row) {
    await supabase.storage.from('activity-videos').remove([videoPath]).catch(() => {});
    await supabase.storage.from('activity-images').remove([posterPath]).catch(() => {});
    return { video: null, error: rowError?.message || 'Could not save video row' };
  }

  return {
    video: {
      ...(row as Omit<ActivityVideoMedia, 'url' | 'posterUrl' | 'likeCount' | 'likedByViewer' | 'commentCount'>),
      url: publicVideoUrl(videoPath),
      posterUrl: publicImageUrl(posterPath),
      likeCount: 0,
      likedByViewer: false,
      commentCount: 0,
    },
    error: null,
  };
}

export async function deleteActivityVideo(params: {
  videoId: string;
  userId: string;
  storagePath: string;
  posterPath: string;
}): Promise<{ error: string | null }> {
  const { videoId, userId, storagePath, posterPath } = params;

  const { error } = await supabase
    .from('activity_videos')
    .delete()
    .eq('id', videoId)
    .eq('uploaded_by', userId);
  if (error) return { error: error.message };

  try {
    await supabase.storage.from('activity-videos').remove([storagePath]);
    await supabase.storage.from('activity-images').remove([posterPath]);
  } catch { /* best-effort */ }

  return { error: null };
}

export async function setActivityVideoLiked(params: {
  videoId: string;
  userId: string;
  liked: boolean;
}): Promise<{ error: string | null }> {
  const { videoId, userId, liked } = params;
  if (liked) {
    const { error } = await supabase.from('activity_video_likes').upsert(
      { video_id: videoId, user_id: userId },
      { onConflict: 'video_id,user_id', ignoreDuplicates: true },
    );
    return { error: error?.message ?? null };
  }
  const { error } = await supabase
    .from('activity_video_likes')
    .delete()
    .eq('video_id', videoId)
    .eq('user_id', userId);
  return { error: error?.message ?? null };
}
