import React, { useState } from 'react';
import type { Profile } from '../lib/supabase';

interface Props {
  profile: Profile | null | undefined;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

function initialOf(profile: Profile | null | undefined): string {
  const name = profile?.display_name || profile?.email || '';
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

const Avatar: React.FC<Props> = ({ profile, size = 32, className, style }) => {
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(profile?.avatar_url) && !errored;

  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: '9999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
    background: 'var(--accent)',
    color: 'white',
    fontWeight: 800,
    fontSize: `${Math.round(size * 0.4)}px`,
    letterSpacing: '0.02em',
    userSelect: 'none',
    ...style,
  };

  return (
    <span className={className} style={baseStyle}>
      {showImage ? (
        <img
          src={profile!.avatar_url!}
          alt=""
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setErrored(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        initialOf(profile)
      )}
    </span>
  );
};

export default Avatar;
