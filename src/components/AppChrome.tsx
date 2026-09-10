import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Loader2, MapPin, Plane, Radar, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTravel } from '../contexts/TravelContext';
import { useNotifications } from '../hooks/useNotifications';
import { useTripSwitcher } from '../hooks/useTripSwitcher';
import { useChrome } from '../contexts/ChromeContext';
import Avatar from './Avatar';
import TripSwitcherModal from './TripSwitcherModal';

/**
 * The same chrome on every screen.
 *
 * One pill on the left, notifications and you on the right. It replaced a
 * header that varied per tab, which is what made moving between tabs feel
 * like moving between apps.
 *
 * The pill's contents come from whichever screen is mounted (see
 * ChromeContext): where you are on Nearby, which city on a trip, the language
 * pair on Language. Same shape and same corner everywhere; different job
 * depending on what you are looking at.
 *
 * The bell sits left of the avatar rather than inside the profile. An unread
 * count has to be visible to do anything, one tap deep and you stop
 * noticing it, which is the same as not having it.
 */
interface Props {
  /** The tab's own name, used when the screen declares no pill of its own. */
  fallbackLabel?: string;
  /**
   * 'top' is the phone's bar across the top. 'rail' is the desktop column
   * down the left, where the same three things stack instead of sitting in a
   * row: the pill at the top, the tabs in the middle, you at the bottom.
   */
  layout?: 'top' | 'rail';
  /** The tabs, in rail layout. Ignored on top. */
  children?: React.ReactNode;
  /**
   * Which side of the app you are on. In the Nearby set the pill must not
   * fall back to the trip's name: walking from Nearby into Tools is not
   * walking into a trip, and a pill saying "Seoul Adventure" over a page
   * about where you are standing is simply wrong.
   */
  context?: 'trip' | 'near';
}

const AppChrome: React.FC<Props> = ({ fallbackLabel, layout = 'top', children, context = 'trip' }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { appMode, currentPlan, currentTripId } = useTravel();
  const { unread } = useNotifications();
  const { pill } = useChrome();
  const [menuOpen, setMenuOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const closeSwitcher = useCallback(() => setSwitcherOpen(false), []);
  const switcher = useTripSwitcher(closeSwitcher);

  // What the pill falls back to: which trip you are on, and a tap to change
  // it. Every tab of a trip is about that trip, so that is the honest default
  // for all of them, and a screen with something more specific to say (Nearby
  // says where you are, Explore says which city) declares its own.
  const inNearby = context === 'near' || appMode === 'local';
  const tripLabel = inNearby ? 'Nearby' : currentPlan?.title || fallbackLabel || 'Your trip';
  const label = pill?.label || tripLabel;
  const Icon = pill?.icon ?? (pill ? MapPin : inNearby ? Radar : Plane);
  const hasMenu = Boolean(pill?.menu);
  const interactive = hasMenu || Boolean(pill?.onPress) || !pill;

  const press = () => {
    if (hasMenu) setMenuOpen((open) => !open);
    else if (pill?.onPress) pill.onPress();
    else {
      void switcher.ensureLoaded();
      setSwitcherOpen(true);
    }
  };

  const circle: React.CSSProperties = {
    width: '44px',
    height: '44px',
    minWidth: '44px',
    borderRadius: '9999px',
    background: 'var(--surface-container-high)',
    color: 'var(--text-primary)',
    border: 'none',
    padding: 0,
  };

  const isRail = layout === 'rail';

  const pillBlock = (
        <div className={isRail ? 'relative w-full' : 'relative min-w-0 flex-1'}>
          {/* A pill that does nothing is a label, and says so by not being a
              button, so a tap never looks available when it is not. */}
          {interactive ? (
            <button
              type="button"
              onClick={press}
              aria-expanded={hasMenu ? menuOpen : undefined}
              aria-label={hasMenu ? `${label}. Choose` : label}
              className={`${isRail ? 'w-full flex' : 'inline-flex'} items-center gap-1.5 px-3.5 rounded-full text-[13px] font-bold max-w-full transition-transform active:scale-95`}
              style={{
                height: '44px',
                background: 'var(--surface-container-high)',
                color: 'var(--text-primary)',
                border: 'none',
              }}
            >
              {pill?.busy ? (
                <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: 'var(--accent)' }} />
              ) : (
                <Icon size={14} className="flex-shrink-0" style={{ color: 'var(--accent)' }} />
              )}
              <span className="truncate">{label}</span>
              {hasMenu && (
                <ChevronDown
                  size={14}
                  className="flex-shrink-0"
                  style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', color: 'var(--text-tertiary)' }}
                />
              )}
            </button>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-3.5 rounded-full text-[13px] font-bold max-w-full"
              style={{ height: '44px', background: 'var(--surface-container-high)', color: 'var(--text-primary)' }}
            >
              <Icon size={14} className="flex-shrink-0" style={{ color: 'var(--accent)' }} />
              <span className="truncate">{label}</span>
            </span>
          )}

          {hasMenu && menuOpen && (
            <div
              className="absolute left-0 z-40 mt-2 rounded-2xl p-1.5"
              style={{
                top: '100%',
                minWidth: 'min(80vw, 17rem)',
                background: 'var(--bg-secondary)',
                border: '0.5px solid var(--outline)',
                boxShadow: 'var(--shadow-lg)',
              }}
              onClick={() => setMenuOpen(false)}
            >
              {pill?.menu}
            </div>
          )}
        </div>
  );

  const youBlock = (
        <div className={isRail ? 'flex items-center gap-2' : 'flex items-center gap-2 flex-shrink-0'}>
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            className="relative flex items-center justify-center transition-transform active:scale-90"
            style={circle}
          >
            <Bell size={17} />
            {unread > 0 && (
              <span
                className="absolute flex items-center justify-center text-[10px] font-extrabold tabular-nums"
                style={{
                  top: '4px',
                  right: '2px',
                  minWidth: '17px',
                  height: '17px',
                  padding: '0 4px',
                  borderRadius: '9999px',
                  background: 'var(--accent)',
                  color: 'var(--on-accent)',
                  // A ring in the bar's own colour, so the badge reads as
                  // sitting on top of the bell rather than merging into it.
                  boxShadow: '0 0 0 2px var(--bg-primary)',
                }}
              >
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label="Your profile"
            className="flex items-center justify-center overflow-hidden transition-transform active:scale-90"
            style={{ ...circle, background: profile ? 'transparent' : circle.background }}
          >
            {profile ? <Avatar profile={profile} size={44} /> : <User size={18} />}
          </button>
        </div>
  );

  const switcherModal = (
      <TripSwitcherModal
        isOpen={switcherOpen}
        onClose={closeSwitcher}
        trips={switcher.trips}
        loading={switcher.loading}
        currentMode={appMode}
        currentTripId={currentTripId}
        onSelectNearby={switcher.toNearby}
        onSelectTrip={switcher.toTrip}
        busyTripId={switcher.busyTripId}
      />
  );

  if (isRail) {
    return (
      <aside
        className="flex flex-col gap-4 flex-shrink-0"
        style={{
          width: '15rem',
          height: '100dvh',
          position: 'sticky',
          top: 0,
          padding: '1.25rem 1rem',
          background: 'var(--bg-primary)',
          // A hairline, not a panel: the rail is part of the same surface as
          // the page, and giving it its own colour split the window in two.
          borderRight: '0.5px solid var(--outline)',
        }}
      >
        {pillBlock}
        <nav className="flex-1 min-h-0 overflow-y-auto">{children}</nav>
        {youBlock}
        {switcherModal}
      </aside>
    );
  }

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        // Real air above the pill. env(safe-area-inset-top) is zero on a
        // desktop and on plenty of phones, so on its own it left the pill
        // pressed against the top edge of the screen.
        paddingTop: 'calc(0.75rem + env(safe-area-inset-top))',
        paddingBottom: '0.5rem',
        // No rule under it: the pill and the avatar already read as chrome,
        // and a line across the screen made every page look boxed in.
        background: 'var(--bg-primary)',
      }}
    >
      <div className="flex items-center justify-between gap-2 px-5">
        {pillBlock}
        {youBlock}
      </div>
      {switcherModal}
    </header>
  );
};

export default AppChrome;
