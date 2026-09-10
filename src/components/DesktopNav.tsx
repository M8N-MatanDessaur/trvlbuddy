import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { PageDef } from './SwipeNavigator';

interface Props {
  pages: PageDef[];
}

/**
 * The tabs, down the side.
 *
 * The same destinations as the bottom bar, in the same order, so moving
 * between a phone and a laptop does not mean learning the app twice. What
 * changes is that a rail has room for the names: on a phone only the current
 * tab can afford its label, and here every one carries it.
 */
const DesktopNav: React.FC<Props> = ({ pages }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex flex-col gap-0.5">
      {pages.map((page) => {
        const Icon = page.icon;
        const isActive = page.path === location.pathname;
        return (
          <button
            key={page.path}
            type="button"
            onClick={() => navigate(page.path)}
            aria-current={isActive ? 'page' : undefined}
            className="flex items-center gap-3 rounded-xl text-left transition-colors"
            style={{
              width: '100%',
              padding: '0 0.875rem',
              height: '44px',
              minHeight: '44px',
              border: 'none',
              background: isActive ? 'var(--accent-container)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <Icon
              size={18}
              strokeWidth={isActive ? 2.2 : 1.7}
              style={{ flexShrink: 0 }}
            />
            <span className="text-[13.5px] font-bold truncate">{page.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default DesktopNav;
