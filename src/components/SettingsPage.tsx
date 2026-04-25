import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Award,
  Cloud,
  FolderOpen,
  Share2,
  Radar,
  LogOut,
  ChevronRight,
  Check,
} from 'lucide-react';
import { useTheme, THEME_OPTIONS } from '../contexts/ThemeContext';
import { useTravel } from '../contexts/TravelContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { saveTrip } from '../services/tripsService';
import MyTripsModal from './MyTripsModal';
import ShareTripModal from './ShareTripModal';
import Avatar from './Avatar';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const currentThemeIsDark = THEME_OPTIONS.find((t) => t.id === theme)?.isDark ?? false;
  const [themeFamily, setThemeFamily] = useState<'light' | 'dark'>(
    currentThemeIsDark ? 'dark' : 'light'
  );
  const themesInFamily = THEME_OPTIONS.filter((t) => t.isDark === (themeFamily === 'dark'));
  const {
    currentPlan,
    activities,
    translations,
    emergencyContacts,
    savedActivities,
    journalEntries,
    appMode,
    setAppMode,
    currentTripId,
    setCurrentTripId,
  } = useTravel();
  const { user, profile, signOut } = useAuth();
  const { toast } = useToast();

  const [showMyTrips, setShowMyTrips] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);
  const [savingToCloud, setSavingToCloud] = useState(false);
  const isLocalMode = appMode === 'local';

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const handleSaveToCloud = async () => {
    if (!user || !currentPlan) return;
    setSavingToCloud(true);
    const { data, error } = await saveTrip({
      ownerId: user.id,
      bundle: {
        currentPlan,
        activities,
        translations,
        emergencyContacts,
        savedActivities,
        journalEntries,
      },
      existingTripId: currentTripId,
    });
    setSavingToCloud(false);
    if (error) toast(error, 'error');
    else {
      if (data?.id) setCurrentTripId(data.id);
      toast('Trip saved to cloud', 'success');
    }
  };

  const handleShareLink = async () => {
    if (!currentTripId) {
      if (!user || !currentPlan) {
        toast('Save the trip to cloud first', 'info');
        return;
      }
      setSavingToCloud(true);
      const { data, error } = await saveTrip({
        ownerId: user.id,
        bundle: {
          currentPlan,
          activities,
          translations,
          emergencyContacts,
          savedActivities,
          journalEntries,
        },
      });
      setSavingToCloud(false);
      if (error || !data) {
        toast(error || 'Could not save trip', 'error');
        return;
      }
      setCurrentTripId(data.id);
    }
    setShowShareLink(true);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const handleSwitchToNearby = () => {
    setAppMode('local');
    navigate('/nearby', { replace: true });
  };

  const displayName = profile?.display_name || profile?.email || 'Traveler';
  const influence = profile?.influence ?? 0;

  const rowClass =
    'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors';
  const sectionLabelClass =
    'text-[11px] font-bold uppercase tracking-[0.12em] px-1 mb-2';

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Top bar */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          height: 'calc(3.25rem + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
          background: 'var(--bg-primary)',
          borderBottom: '0.33px solid var(--outline)',
        }}
      >
        <button
          onClick={goBack}
          className="flex items-center gap-1 px-2 py-1 -ml-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-primary)' }}
          aria-label="Back"
        >
          <ChevronLeft size={20} />
          <span className="text-[14px] font-semibold">Back</span>
        </button>
        <span className="text-[15px] font-extrabold tracking-tight">Settings</span>
        <span className="w-14" aria-hidden="true" />
      </header>

      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: 'calc(4rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
        }}
      >
        <div className="max-w-xl mx-auto px-5 space-y-6">
          {/* Profile card */}
          <div
            className="relative overflow-hidden rounded-3xl p-5"
            style={{
              background: 'var(--surface-container)',
              border: '0.5px solid var(--outline)',
            }}
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--accent) 18%, transparent) 0%, transparent 65%)',
              }}
            />
            <div className="relative flex items-center gap-4">
              <Avatar profile={profile} size={64} />
              <div className="flex-1 min-w-0">
                <div className="text-[17px] font-extrabold tracking-tight truncate">
                  {displayName}
                </div>
                {profile?.email && displayName !== profile.email && (
                  <div
                    className="text-[12.5px] truncate"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {profile.email}
                  </div>
                )}
                <div
                  className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[12px] font-bold"
                  style={{
                    background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Award size={12} style={{ color: 'var(--accent)' }} />
                  <span>{influence}</span>
                  <span style={{ color: 'var(--accent)' }}>Influence</span>
                </div>
              </div>
            </div>
          </div>

          {/* Trip */}
          <section>
            <h2
              className={sectionLabelClass}
              style={{ color: 'var(--text-tertiary)' }}
            >
              Trip
            </h2>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--surface-container)' }}
            >
              {currentPlan && !isLocalMode && user && (
                <button
                  onClick={handleSaveToCloud}
                  disabled={savingToCloud}
                  className={rowClass + ' disabled:opacity-60'}
                  style={{ borderBottom: '0.33px solid var(--outline)' }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
                  >
                    <Cloud size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold">
                      {savingToCloud ? 'Saving...' : 'Save trip to cloud'}
                    </div>
                    <div
                      className="text-[12px]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Store this trip on your account.
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                </button>
              )}

              {user && (
                <button
                  onClick={() => setShowMyTrips(true)}
                  className={rowClass}
                  style={{
                    borderBottom: currentPlan && !isLocalMode ? '0.33px solid var(--outline)' : 'none',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
                  >
                    <FolderOpen size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold">My trips</div>
                    <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                      Browse and restore saved trips.
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                </button>
              )}

              {currentPlan && !isLocalMode && user && (
                <button
                  onClick={handleShareLink}
                  className={rowClass}
                  style={{ borderTop: user ? '0.33px solid var(--outline)' : 'none' }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
                  >
                    <Share2 size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold">Invite to this trip</div>
                    <div
                      className="text-[12px]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Send a link so friends can co-plan it live.
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                </button>
              )}

              {!isLocalMode && currentPlan && (
                <button
                  onClick={handleSwitchToNearby}
                  className={rowClass}
                  style={{ borderTop: '0.33px solid var(--outline)' }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
                  >
                    <Radar size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold">Switch to Nearby</div>
                    <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                      Leave this trip view. Your trip stays saved.
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                </button>
              )}

              {!currentPlan && !isLocalMode && !user && (
                <div
                  className="px-4 py-4 text-[12.5px]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Sign in and start a trip to see your cloud controls here.
                </div>
              )}
            </div>
          </section>

          {/* Appearance */}
          <section>
            <h2
              className={sectionLabelClass}
              style={{ color: 'var(--text-tertiary)' }}
            >
              Theme
            </h2>
            <div
              className="rounded-2xl p-3"
              style={{ background: 'var(--surface-container)' }}
            >
              {/* Light/Dark family switch */}
              <div
                className="flex p-1 rounded-full mb-3"
                style={{ background: 'var(--surface-container-high)' }}
              >
                {(['light', 'dark'] as const).map((family) => {
                  const isActive = themeFamily === family;
                  return (
                    <button
                      key={family}
                      onClick={() => setThemeFamily(family)}
                      className="flex-1 py-1.5 rounded-full text-[12px] font-bold transition-colors capitalize"
                      style={{
                        background: isActive ? 'var(--accent)' : 'transparent',
                        color: isActive ? 'var(--on-accent)' : 'var(--text-secondary)',
                        border: 'none',
                        minHeight: 0,
                      }}
                      aria-pressed={isActive}
                    >
                      {family}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {themesInFamily.map((opt) => {
                  const isActive = theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setTheme(opt.id)}
                      className="relative rounded-2xl overflow-hidden text-left transition-transform active:scale-[0.97]"
                      style={{
                        padding: 0,
                        background: opt.swatch.background,
                        border: isActive
                          ? '2px solid var(--accent)'
                          : '1px solid var(--outline)',
                        minHeight: 0,
                        minWidth: 0,
                      }}
                      aria-label={`Switch to ${opt.label} theme`}
                    >
                      {/* Preview surface */}
                      <div
                        className="px-2.5 py-3"
                        style={{ background: opt.swatch.background, height: '76px' }}
                      >
                        <div
                          className="rounded-lg w-full mb-1.5"
                          style={{
                            background: opt.swatch.surface,
                            height: '14px',
                          }}
                        />
                        <div className="flex items-center gap-1.5">
                          <div
                            className="rounded-full"
                            style={{
                              width: '14px',
                              height: '14px',
                              background: opt.swatch.accent,
                            }}
                          />
                          <div
                            className="flex-1 rounded-full"
                            style={{
                              height: '5px',
                              background: opt.swatch.surface,
                            }}
                          />
                        </div>
                        <div
                          className="rounded-full mt-1.5"
                          style={{
                            background: opt.swatch.surface,
                            height: '5px',
                            width: '60%',
                          }}
                        />
                      </div>
                      {/* Label strip */}
                      <div
                        className="px-2.5 py-1.5"
                        style={{
                          background: 'var(--surface-container-high)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <div className="text-[11.5px] font-extrabold tracking-tight truncate">
                          {opt.label}
                        </div>
                      </div>
                      {isActive && (
                        <div
                          className="absolute top-1.5 right-1.5 rounded-full flex items-center justify-center"
                          style={{
                            width: '20px',
                            height: '20px',
                            background: 'var(--accent)',
                            color: 'var(--on-accent)',
                          }}
                          aria-hidden="true"
                        >
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <p
                className="text-[11px] mt-3 px-1"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Saved to your account, so it follows you across devices.
              </p>
            </div>
          </section>

          {/* Account */}
          {user && (
            <section>
              <h2
                className={sectionLabelClass}
                style={{ color: 'var(--text-tertiary)' }}
              >
                Account
              </h2>
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--surface-container)' }}
              >
                <button onClick={handleSignOut} className={rowClass}>
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: 'var(--surface-container-high)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <LogOut size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold">Sign out</div>
                    <div
                      className="text-[12px]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {profile?.email || 'Signed in'}
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      <MyTripsModal isOpen={showMyTrips} onClose={() => setShowMyTrips(false)} />
      <ShareTripModal
        isOpen={showShareLink}
        onClose={() => setShowShareLink(false)}
        tripId={currentTripId}
      />
    </div>
  );
};

export default SettingsPage;
