import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tokenizeMentions } from '../lib/mentions';

interface Props {
  body: string;
  className?: string;
  style?: React.CSSProperties;
}

// Render a comment body with `@[name](uuid)` tokens replaced by tappable
// links that route to the mentioned user's profile.

const MentionBody: React.FC<Props> = ({ body, className, style }) => {
  const navigate = useNavigate();
  const tokens = tokenizeMentions(body);

  return (
    <p className={className} style={style}>
      {tokens.map((t, i) => {
        if (t.kind === 'text') {
          return <React.Fragment key={i}>{t.value}</React.Fragment>;
        }
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (t.userId) navigate(`/profile/${t.userId}`);
            }}
            style={{
              color: 'var(--accent)',
              background: 'transparent',
              border: 'none',
              padding: 0,
              margin: 0,
              font: 'inherit',
              fontWeight: 700,
              cursor: 'pointer',
              minWidth: 0,
              minHeight: 0,
            }}
          >
            @{t.value}
          </button>
        );
      })}
    </p>
  );
};

export default MentionBody;
