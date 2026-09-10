import React from 'react';
import { Check, X } from 'lucide-react';
import Avatar from '../Avatar';
import { describeInterest, type ActivityInterest, type Interest } from '../../services/tripInterest';

interface Props {
  interest: ActivityInterest | undefined;
  /** Null while nobody is signed in, which makes this read-only. */
  viewerId: string | null;
  onSet: (state: Interest | null) => void;
  busy?: boolean;
}

/** Faces before it becomes a list. */
const MAX_FACES = 4;

/**
 * Who is coming to this, and whether you are.
 *
 * Tapping "I'm in" again takes it back rather than switching you to out --
 * withdrawing and refusing are different things, and the common case by far
 * is a mis-tap or a change of plan, not a statement against it.
 */
const InterestRow: React.FC<Props> = ({ interest, viewerId, onSet, busy = false }) => {
  const mine = interest?.mine ?? null;
  const summary = describeInterest(interest);
  const faces = (interest?.in ?? []).slice(0, MAX_FACES);
  const extra = Math.max(0, (interest?.in.length ?? 0) - faces.length);

  const pill = (active: boolean): React.CSSProperties => ({
    height: '32px',
    padding: '0 0.7rem',
    borderRadius: '9999px',
    border: 'none',
    minHeight: 0,
    background: active ? 'var(--accent)' : 'var(--surface-container-high)',
    color: active ? 'var(--on-accent)' : 'var(--text-secondary)',
    opacity: busy ? 0.6 : 1,
  });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {faces.length > 0 && (
        <div className="flex items-center flex-shrink-0" aria-hidden="true">
          {faces.map((person, i) => (
            <div
              key={person.id}
              className="rounded-full overflow-hidden"
              style={{
                marginLeft: i === 0 ? 0 : '-7px',
                boxShadow: '0 0 0 1.5px var(--surface-container)',
                width: '22px',
                height: '22px',
              }}
            >
              <Avatar
                profile={{ display_name: person.name, avatar_url: person.avatarUrl }}
                size={22}
              />
            </div>
          ))}
          {extra > 0 && (
            <span
              className="text-[11px] font-bold ml-1.5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              +{extra}
            </span>
          )}
        </div>
      )}

      {summary && (
        <span className="text-[11.5px] font-bold" style={{ color: 'var(--text-secondary)' }}>
          {summary}
        </span>
      )}

      {viewerId && (
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onSet(mine === 'in' ? null : 'in');
            }}
            aria-pressed={mine === 'in'}
            aria-label={mine === 'in' ? 'You are in. Take it back' : 'Say you are in'}
            className="inline-flex items-center gap-1.5 text-[12px] font-bold transition-transform active:scale-95"
            style={pill(mine === 'in')}
          >
            <Check size={13} />
            {mine === 'in' ? "I'm in" : 'Count me in'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onSet(mine === 'out' ? null : 'out');
            }}
            aria-pressed={mine === 'out'}
            aria-label={mine === 'out' ? 'You are out. Take it back' : 'Say you are not coming'}
            className="inline-flex items-center justify-center transition-transform active:scale-95"
            style={{ ...pill(mine === 'out'), width: '32px', padding: 0 }}
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
};

export default InterestRow;
