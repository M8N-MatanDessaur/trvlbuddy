import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Supabase Realtime presence wrapper for a trip channel. Returns the set
// of user_ids currently joined to the trip's presence channel — meaning
// they have the trip open in another tab / device right now. Lets the
// member strip show a live "online" dot without inventing a separate
// last-seen heartbeat.
export function useTripPresence(tripId: string | null): { presentUserIds: Set<string> } {
  const { user } = useAuth();
  const [presentUserIds, setPresentUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!tripId || !user?.id) {
      setPresentUserIds(new Set());
      return;
    }
    // The presence key MUST be unique per connection or two tabs from the
    // same user collide and one drops. user_id alone is fine for "is this
    // person here?" but we'd lose tab-level granularity — fine for v1.
    const channel = supabase.channel(`trip-presence-${tripId}`, {
      config: { presence: { key: user.id } },
    });

    const recompute = () => {
      const state = channel.presenceState();
      setPresentUserIds(new Set(Object.keys(state)));
    };

    channel
      .on('presence', { event: 'sync' }, recompute)
      .on('presence', { event: 'join' }, recompute)
      .on('presence', { event: 'leave' }, recompute)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, user?.id]);

  return { presentUserIds };
}
