import type { QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { queryKeys } from './queryKeys';

// Wires Supabase Realtime postgres_changes into React Query cache
// invalidation. One channel per table, fired ONCE at app start. When a
// row changes, we narrow the invalidation to the SPECIFIC affected
// activity / user — never the whole namespace — so 50 cards on screen
// don't all refetch when one upvote lands somewhere unrelated.
//
// Cache key for activity-media is ['activity-media', key, viewerId]
// where `key` is an ActivityKey object (name + place id + …), not the
// resolved activityId. We can't pre-compute the cached activityId from
// the key, so we narrow via a predicate that inspects each query's
// cached snapshot data.
//
// Self-write suppression: postgres_changes echoes back to the SAME client
// that made the write. Without filtering, the actor's optimistic update
// gets overwritten by a refetch that races the trigger fanout — this
// produced the "click upvote, see 1, then see 0, click again to make it
// stick" UX bug. We track the current auth user and skip invalidations
// when the row's actor (user_id / uploaded_by) is the current user; their
// optimistic cache is already correct. Other users' echoes still fire.

let currentUserId: string | null = null;
supabase.auth.getUser().then(({ data }) => {
  currentUserId = data.user?.id ?? null;
}).catch(() => { /* unauthenticated — leave as null */ });
supabase.auth.onAuthStateChange((_event, session) => {
  currentUserId = session?.user?.id ?? null;
});

function isSelfWrite(actorId: string | undefined): boolean {
  return Boolean(actorId && currentUserId && actorId === currentUserId);
}

// Shape of an activity-media cache entry. Local copy to keep this file
// independent of the hook module.
interface ActivityMediaSnapshot {
  activityId: string | null;
  images: Array<{ id: string }>;
  videos: Array<{ id: string }>;
}

function invalidateByActivityId(qc: QueryClient, activityId: string | undefined | null): void {
  if (!activityId) return;
  qc.invalidateQueries({
    predicate: (query) => {
      if (query.queryKey[0] !== 'activity-media') return false;
      const data = query.state.data as ActivityMediaSnapshot | undefined;
      return data?.activityId === activityId;
    },
  });
}

function invalidateByImageId(qc: QueryClient, imageId: string | undefined | null): void {
  if (!imageId) return;
  qc.invalidateQueries({
    predicate: (query) => {
      if (query.queryKey[0] !== 'activity-media') return false;
      const data = query.state.data as ActivityMediaSnapshot | undefined;
      return data?.images.some((i) => i.id === imageId) ?? false;
    },
  });
}

function invalidateByVideoId(qc: QueryClient, videoId: string | undefined | null): void {
  if (!videoId) return;
  qc.invalidateQueries({
    predicate: (query) => {
      if (query.queryKey[0] !== 'activity-media') return false;
      const data = query.state.data as ActivityMediaSnapshot | undefined;
      return data?.videos.some((v) => v.id === videoId) ?? false;
    },
  });
}

// Profile media cache is keyed by userId so we can narrow directly.
// On upload events the affected user is `uploaded_by`. On likes /
// comments the affected user is the *image owner* (engagement received
// drives counts), which we'd need a join to look up. To stay cheap we
// only invalidate the actor's own profile in those cases — the
// recipient sees the count update on their next mount or via the
// 30s staleTime kicking in. Acceptable since likes/comments don't
// change the visible photo grid, just counters.
function invalidateProfileForUser(qc: QueryClient, userId: string | undefined | null): void {
  if (!userId) return;
  qc.invalidateQueries({ queryKey: queryKeys.profileMedia(userId) });
}

type Payload = {
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
};

function pickField(p: Payload, field: string): string | undefined {
  const fromNew = (p.new as Record<string, unknown> | null | undefined)?.[field];
  const fromOld = (p.old as Record<string, unknown> | null | undefined)?.[field];
  const v = (typeof fromNew === 'string' ? fromNew : undefined) ?? (typeof fromOld === 'string' ? fromOld : undefined);
  return v;
}

export function installRealtimeBridge(qc: QueryClient): () => void {
  const channels = [
    supabase
      .channel('rt-activity-images')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_images' }, (payload) => {
        const uploadedBy = pickField(payload as Payload, 'uploaded_by');
        if (isSelfWrite(uploadedBy)) return;
        invalidateByActivityId(qc, pickField(payload as Payload, 'activity_id'));
        invalidateProfileForUser(qc, uploadedBy);
      })
      .subscribe(),

    supabase
      .channel('rt-activity-videos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_videos' }, (payload) => {
        const uploadedBy = pickField(payload as Payload, 'uploaded_by');
        if (isSelfWrite(uploadedBy)) return;
        invalidateByActivityId(qc, pickField(payload as Payload, 'activity_id'));
        invalidateProfileForUser(qc, uploadedBy);
      })
      .subscribe(),

    supabase
      .channel('rt-activity-votes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_votes' }, (payload) => {
        const userId = pickField(payload as Payload, 'user_id');
        if (isSelfWrite(userId)) return;
        invalidateByActivityId(qc, pickField(payload as Payload, 'activity_id'));
      })
      .subscribe(),

    supabase
      .channel('rt-activity-image-likes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_image_likes' }, (payload) => {
        const userId = pickField(payload as Payload, 'user_id');
        if (isSelfWrite(userId)) return;
        invalidateByImageId(qc, pickField(payload as Payload, 'image_id'));
      })
      .subscribe(),

    supabase
      .channel('rt-activity-image-comments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_image_comments' }, (payload) => {
        const userId = pickField(payload as Payload, 'user_id');
        if (isSelfWrite(userId)) return;
        invalidateByImageId(qc, pickField(payload as Payload, 'image_id'));
      })
      .subscribe(),

    supabase
      .channel('rt-activity-video-likes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_video_likes' }, (payload) => {
        const userId = pickField(payload as Payload, 'user_id');
        if (isSelfWrite(userId)) return;
        invalidateByVideoId(qc, pickField(payload as Payload, 'video_id'));
      })
      .subscribe(),

    supabase
      .channel('rt-activity-video-comments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_video_comments' }, (payload) => {
        const userId = pickField(payload as Payload, 'user_id');
        if (isSelfWrite(userId)) return;
        invalidateByVideoId(qc, pickField(payload as Payload, 'video_id'));
      })
      .subscribe(),
  ];

  return () => {
    for (const ch of channels) supabase.removeChannel(ch);
  };
}
