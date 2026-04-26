import type { QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

// Wires Supabase Realtime postgres_changes into React Query cache
// invalidation. One channel per table, fired ONCE at app start. When any
// row changes we invalidate every query whose key starts with the
// matching namespace; React Query then refetches the visible queries
// and silently drops the rest from the cache. This is how Instagram-style
// "instant cross-user" feels in practice — a like by anyone in the
// world fires postgres_changes, the bridge invalidates the activity-media
// key, and every open card with that activityId refetches within ~100ms.
//
// We intentionally invalidate broadly (the whole namespace) rather than
// narrowly (one specific user-id). React Query dedupes refetches and
// only network-fetches queries with active observers, so the broad
// invalidate is cheap AND simple.
export function installRealtimeBridge(qc: QueryClient): () => void {
  const channels = [
    // Profile counts + photo grid: any new photo / video / like / comment
    // anywhere should refresh open profiles since we don't track which
    // userId is on screen.
    supabase
      .channel('rt-activity-images')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_images' }, () => {
        qc.invalidateQueries({ queryKey: ['activity-media'] });
        qc.invalidateQueries({ queryKey: ['profile-media'] });
      })
      .subscribe(),

    supabase
      .channel('rt-activity-videos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_videos' }, () => {
        qc.invalidateQueries({ queryKey: ['activity-media'] });
        qc.invalidateQueries({ queryKey: ['profile-media'] });
      })
      .subscribe(),

    supabase
      .channel('rt-activity-votes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_votes' }, () => {
        qc.invalidateQueries({ queryKey: ['activity-media'] });
      })
      .subscribe(),

    supabase
      .channel('rt-activity-image-likes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_image_likes' }, () => {
        qc.invalidateQueries({ queryKey: ['activity-media'] });
        qc.invalidateQueries({ queryKey: ['profile-media'] });
      })
      .subscribe(),

    supabase
      .channel('rt-activity-image-comments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_image_comments' }, () => {
        qc.invalidateQueries({ queryKey: ['activity-media'] });
        qc.invalidateQueries({ queryKey: ['profile-media'] });
      })
      .subscribe(),

    supabase
      .channel('rt-activity-video-likes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_video_likes' }, () => {
        qc.invalidateQueries({ queryKey: ['activity-media'] });
        qc.invalidateQueries({ queryKey: ['profile-media'] });
      })
      .subscribe(),

    supabase
      .channel('rt-activity-video-comments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_video_comments' }, () => {
        qc.invalidateQueries({ queryKey: ['activity-media'] });
        qc.invalidateQueries({ queryKey: ['profile-media'] });
      })
      .subscribe(),
  ];

  return () => {
    for (const ch of channels) supabase.removeChannel(ch);
  };
}
