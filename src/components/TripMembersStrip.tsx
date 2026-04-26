import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus } from 'lucide-react';
import Avatar from './Avatar';
import { listTripMembers, type TripMemberWithProfile } from '../services/tripMembersService';
import { useTripPresence } from '../hooks/useTripPresence';

interface Props {
  tripId: string | null;
  onInvite: () => void;
  max?: number;
}

const TripMembersStrip: React.FC<Props> = ({ tripId, onInvite, max = 5 }) => {
  const [members, setMembers] = useState<TripMemberWithProfile[]>([]);
  const { presentUserIds } = useTripPresence(tripId);

  useEffect(() => {
    if (!tripId) {
      setMembers([]);
      return;
    }
    let alive = true;
    listTripMembers(tripId).then((m) => {
      if (alive) setMembers(m);
    });

    const channel = supabase
      .channel(`trip-members-${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_members', filter: `trip_id=eq.${tripId}` },
        () => {
          listTripMembers(tripId).then((m) => {
            if (alive) setMembers(m);
          });
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  if (!tripId) return null;

  const visible = members.slice(0, max);
  const overflow = Math.max(0, members.length - visible.length);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center" style={{ marginLeft: visible.length ? '6px' : 0 }}>
        {visible.map((m, i) => {
          const isOnline = presentUserIds.has(m.user_id);
          return (
            <div
              key={m.user_id}
              title={`${m.profile?.display_name || m.profile?.email || ''}${isOnline ? ' • online' : ''}`}
              style={{
                position: 'relative',
                marginLeft: i === 0 ? '-6px' : '-8px',
                zIndex: visible.length - i,
                // Green ring for online members reads more naturally than a
                // corner dot at this size. Box-shadow draws it outside the
                // avatar bounds without changing layout, so the strip's
                // overlap geometry stays untouched.
                borderRadius: '9999px',
                boxShadow: isOnline ? '0 0 0 2px #22c55e' : 'none',
              }}
            >
              <Avatar profile={m.profile} size={28} />
            </div>
          );
        })}
        {overflow > 0 && (
          <div
            style={{
              marginLeft: '-8px',
              zIndex: 0,
              width: '28px',
              height: '28px',
              borderRadius: '9999px',
              background: 'var(--surface-container-high)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 800,
            }}
          >
            +{overflow}
          </div>
        )}
      </div>
      <button
        onClick={onInvite}
        className="flex items-center justify-center w-8 h-8 rounded-full transition active:scale-95"
        style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
        aria-label="Invite to trip"
      >
        <UserPlus size={15} />
      </button>
    </div>
  );
};

export default TripMembersStrip;
