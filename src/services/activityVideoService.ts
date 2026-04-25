import { supabase, publicImageUrl } from '../lib/supabase';
import { computeThumbhashFromFile } from '../lib/thumbhash';
import { extractMentionedUserIds } from '../lib/mentions';

export interface ActivityVideoMedia {
  id: string;
  activity_id: string;
  uploaded_by: string;
  storage_path: string;
  poster_path: string;
  thumbhash: string | null;
  duration_ms: number | null;
  start_ms: number | null; // playback offset into the source clip
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
  startMs: number;
  width: number;
  height: number;
  onProgress?: (progress: number) => void;
}

// Uploads the source video bytes as-is (no transcoding) plus the
// extracted poster frame, computes a thumbhash from the poster for
// the placeholder, then writes the activity_videos row with the trim
// window so the player can scope playback.
//
// The video upload goes through createSignedUploadUrl + XHR PUT so we
// get real bytes-uploaded progress events (the supabase-js fetch path
// can't report upload progress). The poster is small (~200KB) so it
// rides the regular client and runs in parallel.
export async function uploadActivityVideo(
  params: UploadActivityVideoParams,
): Promise<{ video: ActivityVideoMedia | null; error: string | null }> {
  const { activityId, uploaderId, video, poster, durationMs, startMs, width, height, onProgress } = params;

  const ts = Date.now();
  const stub = `${uploaderId}-${ts}-${Math.random().toString(36).slice(2, 8)}`;
  // We upload the source as-is, so storage path + Content-Type follow the
  // file the user picked. Most phone clips are .mp4 (H.264) or .mov (HEVC);
  // both modern Safari and Chrome handle both. We default to mp4 if the
  // file's MIME is missing/odd so the upload still succeeds.
  const { ext: videoExt, mime: videoMime } = pickVideoExtAndMime(video);
  const videoPath = `${activityId}/${stub}.${videoExt}`;
  const posterPath = `${activityId}/${stub}.jpg`;

  // Reserve a signed upload URL up front so we can PUT the bytes via XHR
  // and watch progress events. Failing here is rare (auth/RLS issue) and
  // shouldn't even start the parallel work below.
  const { data: signed, error: signError } = await supabase.storage
    .from('activity-videos')
    .createSignedUploadUrl(videoPath);
  if (signError || !signed?.signedUrl) {
    return { video: null, error: signError?.message || 'Could not start video upload.' };
  }

  onProgress?.(0);

  const [videoUploadError, posterRes, thumbhash] = await Promise.all([
    putWithProgress(signed.signedUrl, video, videoMime, onProgress).then(
      () => null,
      (e: Error) => e,
    ),
    // Posters live in the existing activity-images bucket so the same
    // CDN cache + RLS + image pipeline handles them.
    supabase.storage.from('activity-images').upload(posterPath, poster, {
      cacheControl: '31536000',
      upsert: false,
      contentType: 'image/jpeg',
    }),
    computeThumbhashFromFile(poster),
  ]);

  if (videoUploadError) return { video: null, error: videoUploadError.message };
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
      start_ms: startMs,
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

// PUT a file body to a Supabase signed upload URL via XHR so we can
// surface bytes-uploaded progress (fetch can't observe upload progress
// reliably across browsers). Resolves on a 2xx and rejects with a
// useful message on anything else, including network failures and the
// "object exceeded the maximum allowed size" error from the bucket.
function putWithProgress(
  signedUrl: string,
  file: File,
  contentType: string,
  onProgress?: (p: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl, true);
    // x-upsert:false matches the regular .upload() default and lets the
    // server reject duplicate paths cleanly instead of silently overwriting.
    xhr.setRequestHeader('x-upsert', 'false');
    if (contentType) xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (!onProgress) return;
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.min(1, e.loaded / e.total));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      // Surface Supabase's structured error if the body is JSON; otherwise
      // fall back to status-text. The bucket-size error reads
      // "The object exceeded the maximum allowed size".
      let message = `Upload failed (${xhr.status})`;
      try {
        const parsed = JSON.parse(xhr.responseText);
        if (parsed?.message) message = String(parsed.message);
        else if (parsed?.error) message = String(parsed.error);
      } catch {
        if (xhr.responseText) message = xhr.responseText.slice(0, 200);
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.onabort = () => reject(new Error('Upload was cancelled.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out.'));
    xhr.send(file);
  });
}

// Picks an extension + MIME from the source file. The browser fills in
// `file.type` for picker uploads; for camera-captured clips it's usually
// "video/quicktime" (.mov on iOS) or "video/mp4". Anything we don't
// recognise falls back to mp4 so the upload still has a valid header.
function pickVideoExtAndMime(file: File): { ext: string; mime: string } {
  const t = (file.type || '').toLowerCase();
  if (t.includes('quicktime') || t.includes('mov')) return { ext: 'mov', mime: 'video/quicktime' };
  if (t.includes('webm')) return { ext: 'webm', mime: 'video/webm' };
  if (t.includes('mp4') || t.includes('mpeg-4')) return { ext: 'mp4', mime: 'video/mp4' };
  // Fall back to the file extension if MIME is unhelpful.
  const m = file.name.match(/\.(mov|mp4|webm|m4v)$/i);
  if (m) {
    const ext = m[1].toLowerCase();
    if (ext === 'mov') return { ext: 'mov', mime: 'video/quicktime' };
    if (ext === 'webm') return { ext: 'webm', mime: 'video/webm' };
    if (ext === 'm4v') return { ext: 'm4v', mime: 'video/mp4' };
    return { ext: 'mp4', mime: 'video/mp4' };
  }
  return { ext: 'mp4', mime: 'video/mp4' };
}

export async function isVideoLikedByViewer(videoId: string, viewerId: string): Promise<boolean> {
  const { data } = await supabase
    .from('activity_video_likes')
    .select('video_id')
    .eq('video_id', videoId)
    .eq('user_id', viewerId)
    .maybeSingle();
  return !!data;
}

export interface ActivityVideoComment {
  id: string;
  video_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  parent_comment_id: string | null;
}

export async function listActivityVideoComments(videoId: string): Promise<ActivityVideoComment[]> {
  const { data, error } = await supabase
    .from('activity_video_comments')
    .select('id, video_id, user_id, body, created_at, updated_at, deleted_at, parent_comment_id')
    .eq('video_id', videoId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data;
}

export async function addActivityVideoComment(params: {
  videoId: string;
  userId: string;
  body: string;
  parentCommentId?: string | null;
}): Promise<{ comment: ActivityVideoComment | null; error: string | null }> {
  const body = params.body.trim();
  if (!body) return { comment: null, error: 'Comment cannot be empty' };

  const { data, error } = await supabase
    .from('activity_video_comments')
    .insert({
      video_id: params.videoId,
      user_id: params.userId,
      body,
      parent_comment_id: params.parentCommentId ?? null,
    })
    .select('id, video_id, user_id, body, created_at, updated_at, deleted_at, parent_comment_id')
    .maybeSingle();

  if (!error && data) {
    const mentioned = extractMentionedUserIds(body).filter((id) => id !== params.userId);
    if (mentioned.length > 0) {
      void supabase
        .from('comment_mentions')
        .insert(mentioned.map((uid) => ({ comment_id: data.id, user_id: uid })))
        .then(({ error: mErr }) => {
          if (mErr) console.warn('mention insert failed', mErr);
        });
    }
  }

  return {
    comment: data ?? null,
    error: error?.message ?? null,
  };
}

export async function updateActivityVideoComment(params: {
  commentId: string;
  userId: string;
  body: string;
}): Promise<{ comment: ActivityVideoComment | null; error: string | null }> {
  const body = params.body.trim();
  if (!body) return { comment: null, error: 'Comment cannot be empty' };

  const { data, error } = await supabase
    .from('activity_video_comments')
    .update({ body })
    .eq('id', params.commentId)
    .eq('user_id', params.userId)
    .is('deleted_at', null)
    .select('id, video_id, user_id, body, created_at, updated_at, deleted_at, parent_comment_id')
    .maybeSingle();

  return {
    comment: data ?? null,
    error: error?.message ?? null,
  };
}

export async function deleteActivityVideoComment(params: {
  commentId: string;
  userId: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('activity_video_comments')
    .update({
      body: 'This comment was deleted.',
      deleted_at: new Date().toISOString(),
    })
    .eq('id', params.commentId)
    .eq('user_id', params.userId)
    .is('deleted_at', null);

  return { error: error?.message ?? null };
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

// Profile-grid representation of a video — parallels UserPhoto so the
// profile page can mix the two arrays into one chronological grid.
export interface UserVideo {
  id: string;
  url: string;
  posterUrl: string;
  storage_path: string;
  poster_path: string;
  thumbhash: string | null;
  duration_ms: number | null;
  start_ms: number | null;
  width: number | null;
  height: number | null;
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

export async function listUserVideos(userId: string): Promise<UserVideo[]> {
  const { data: rows, error } = await supabase
    .from('activity_videos')
    .select(
      'id, storage_path, poster_path, thumbhash, duration_ms, start_ms, width, height, created_at, activity_id, activities!inner(name, slug, address, google_place_id, google_maps_url)',
    )
    .eq('uploaded_by', userId)
    .order('created_at', { ascending: false });
  if (error || !rows || rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const likeCounts = new Map<string, number>();
  const commentCounts = new Map<string, number>();

  const [{ data: likes }, { data: comments }] = await Promise.all([
    supabase.from('activity_video_likes').select('video_id').in('video_id', ids),
    supabase.from('activity_video_comments').select('video_id, deleted_at').in('video_id', ids),
  ]);

  likes?.forEach((row) => {
    likeCounts.set(row.video_id, (likeCounts.get(row.video_id) || 0) + 1);
  });
  comments?.forEach((row) => {
    if (row.deleted_at) return;
    commentCounts.set(row.video_id, (commentCounts.get(row.video_id) || 0) + 1);
  });

  return rows.map((row) => {
    const activity = (row as unknown as {
      activities: {
        name: string;
        slug: string;
        address: string | null;
        google_place_id: string | null;
        google_maps_url: string | null;
      };
    }).activities;
    return {
      id: row.id,
      storage_path: row.storage_path,
      poster_path: row.poster_path,
      thumbhash: row.thumbhash ?? null,
      duration_ms: row.duration_ms,
      start_ms: row.start_ms,
      width: row.width,
      height: row.height,
      created_at: row.created_at,
      activity_id: row.activity_id,
      activity_name: activity.name,
      activity_slug: activity.slug,
      activity_address: activity.address,
      google_place_id: activity.google_place_id,
      google_maps_url: activity.google_maps_url,
      url: publicVideoUrl(row.storage_path),
      posterUrl: publicImageUrl(row.poster_path),
      likeCount: likeCounts.get(row.id) || 0,
      commentCount: commentCounts.get(row.id) || 0,
    };
  });
}
