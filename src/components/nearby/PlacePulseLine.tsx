import React from 'react';
import Avatar from '../Avatar';
import { describePulse, type PlacePulse } from '../../services/placePulse';

interface Props {
  pulse: PlacePulse | null | undefined;
  /** True over a photograph, where everything has to read white. */
  onMedia?: boolean;
}

/**
 * Whether anyone has been here.
 *
 * Three faces and a count, and only when there is something to say, a place
 * nobody has touched shows nothing at all rather than a row of zeroes. The
 * faces are the point: a place looks visited because you can see that people
 * visited it, which is a different claim from a rating out of five.
 *
 * No names, no follower counts, nothing that ranks the people. They are here
 * as evidence about the place.
 */
const PlacePulseLine: React.FC<Props> = ({ pulse, onMedia = false }) => {
  if (!pulse || (pulse.photos === 0 && pulse.tips === 0)) return null;

  const text = describePulse(pulse);
  const colour = onMedia ? 'rgba(255,255,255,0.92)' : 'var(--text-secondary)';
  const ring = onMedia ? 'rgba(0,0,0,0.45)' : 'var(--bg-primary)';

  return (
    <div className="flex items-center gap-2 min-w-0">
      {pulse.contributors.length > 0 && (
        <div className="flex items-center flex-shrink-0" aria-hidden="true">
          {pulse.contributors.map((person, i) => (
            <div
              key={person.id}
              className="rounded-full overflow-hidden"
              style={{
                // Overlapped, so a group reads as a group at a glance.
                marginLeft: i === 0 ? 0 : '-7px',
                boxShadow: `0 0 0 1.5px ${ring}`,
                width: '20px',
                height: '20px',
              }}
            >
              <Avatar
                profile={{ display_name: person.name, avatar_url: person.avatarUrl }}
                size={20}
              />
            </div>
          ))}
        </div>
      )}
      <span
        className="text-[11.5px] font-bold truncate"
        style={{ color: colour }}
      >
        {text}
      </span>
    </div>
  );
};

export default PlacePulseLine;
