import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Award,
  ChevronLeft,
  Heart,
  Image as ImageIcon,
  LogOut,
  MapPin,
  MessageCircle,
  Plane,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTravel } from '../contexts/TravelContext';
import { supabase, type Profile, type Trip } from '../lib/supabase';
import {
  getUserSocialStats,
  listUserPhotos,
  type UserPhoto,
  type UserSocialStats,
} from '../services/activityMediaService';
import { listMyTrips, loadTrip } from '../services/tripsService';
import Avatar from './Avatar';
import PhotoViewerModal from './PhotoViewerModal';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ userId?: string }>();
  const { user, profile: ownProfile, signOut } = useAuth();
  const { toast } = useToast();
  const {
    setCurrentPlan,
    setActivities,
    setTranslations,
    setEmergencyContacts,
    setHasCompletedOnboarding,
    setAppMode,
    setCurrentTripId,
  } = useTravel();

  const isOwn = !params.userId || (user?.id ? params.userId === user.id : false);
  const targetId = isOwn ? user?.id ?? null : params.userId ?? null;

  const [profile, setProfile] = useState<Profile | null>(isOwn ? ownProfile : null);
  const [profileLoading, setProfileLoading] = useState(!isOwn);
  const [stats, setStats] = useState<UserSocialStats>({ postCount: 0, likesReceived: 0, commentsReceived: 0 });
  const [photos, setPhotos] = useState<UserPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(isOwn);
  const [loadingTripId, setLoadingTripId] = useState<string | null>(null);
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);

  useEffect(() => {
    if (isOwn) setProfile(ownProfile);
  }, [isOwn, ownProfile]);

  useEffect(() => {
    if (isOwn || !params.userId) return;
    setProfileLoading(true);
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', params.userId!)
        .maybeSingle();
      if (!alive) return;
      setProfile(data ?? null);
      setProfileLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [isOwn, params.userId]);

  useEffect(() => {
    if (!targetId) return;
    let alive = true;
    setPhotosLoading(true);

    Promise.all([getUserSocialStats(targetId), listUserPhotos(targetId)]).then(([s, p]) => {
      if (!alive) return;
      setStats(s);
      setPhotos(p);
      setPhotosLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [targetId]);

  useEffect(() => {
    if (!isOwn || !user) return;
    let alive = true;
    setTripsLoading(true);
    listMyTrips(user.id)
      .then((rows) => {
        if (alive) setTrips(rows);
      })
      .finally(() => {
        if (alive) setTripsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isOwn, user?.id]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const handleLoadTrip = async (tripId: string) => {
    setLoadingTripId(tripId);
    const row = await loadTrip(tripId);
    setLoadingTripId(null);
    if (!row) {
      toast('Could not load trip', 'error');
      return;
    }
    const bundle = row.plan;
    if (!bundle?.currentPlan) {
      toast('Trip has no saved plan', 'error');
      return;
    }
    setCurrentPlan(bundle.currentPlan);
    setActivities(bundle.activities || []);
    setTranslations(bundle.translations || []);
    setEmergencyContacts(bundle.emergencyContacts || []);
    setAppMode('trip');
    setHasCompletedOnboarding(true);
    setCurrentTripId(row.id);
    toast(`Loaded ${row.title}`, 'success');
    navigate('/');
  };

  const handlePhotoTap = (photo: UserPhoto) => {
    setOpenPhotoId(photo.id);
  };

  const openPhoto = openPhotoId ? photos.find((p) => p.id === openPhotoId) ?? null : null;

  const displayName = profile?.display_name || profile?.email || (isOwn ? 'Traveler' : 'Traveler');
  const influence = profile?.influence ?? 0;

  const sectionLabelClass = 'text-[11px] font-bold uppercase tracking-[0.12em] px-1 mb-2';

  const headerStats = useMemo(
    () => [
      { label: 'Posts', value: stats.postCount, icon: ImageIcon },
      { label: 'Likes', value: stats.likesReceived, icon: Heart },
      { label: 'Comments', value: stats.commentsReceived, icon: MessageCircle },
    ],
    [stats],
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          height: '3.25rem',
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
        <span className="text-[15px] font-extrabold tracking-tight">
          {isOwn ? 'Profile' : displayName}
        </span>
        {isOwn ? (
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Open settings"
          >
            <SettingsIcon size={18} />
          </button>
        ) : (
          <span className="w-9" aria-hidden="true" />
        )}
      </header>

      <main className="flex-1 overflow-y-auto" style={{ paddingTop: '4rem', paddingBottom: '2rem' }}>
        <div className="max-w-xl mx-auto px-5 space-y-6">
          {/* Profile header */}
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
              <Avatar profile={profile} size={72} />
              <div className="flex-1 min-w-0">
                <div className="text-[18px] font-extrabold tracking-tight truncate">
                  {profileLoading ? 'Loading...' : displayName}
                </div>
                {isOwn && profile?.email && displayName !== profile.email && (
                  <div className="text-[12.5px] truncate" style={{ color: 'var(--text-secondary)' }}>
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

            {/* Stats row */}
            <div className="relative grid grid-cols-3 gap-2 mt-4">
              {headerStats.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl p-3 flex flex-col items-center gap-1"
                  style={{ background: 'var(--surface-container-high)' }}
                >
                  <Icon size={14} style={{ color: 'var(--accent)' }} />
                  <div className="text-[16px] font-extrabold leading-none">{value}</div>
                  <div className="text-[10.5px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-tertiary)' }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Photos */}
          <section>
            <h2 className={sectionLabelClass} style={{ color: 'var(--text-tertiary)' }}>
              {isOwn ? 'My photos' : 'Photos'}
            </h2>
            {photosLoading ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="activity-card-shimmer rounded-xl"
                    style={{ aspectRatio: '1 / 1', background: 'var(--surface-container-high)' }}
                  />
                ))}
              </div>
            ) : photos.length === 0 ? (
              <div
                className="rounded-2xl px-4 py-6 text-center"
                style={{ background: 'var(--surface-container)', color: 'var(--text-secondary)' }}
              >
                <ImageIcon size={20} className="mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-[13px] font-bold">
                  {isOwn ? 'No photos yet' : 'Nothing posted yet'}
                </p>
                <p className="text-[12px] mt-1">
                  {isOwn ? 'Tap the plus button on a place to share a photo.' : ' '}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => handlePhotoTap(photo)}
                    className="relative overflow-hidden rounded-xl transition-transform active:scale-95"
                    style={{
                      aspectRatio: '1 / 1',
                      background: 'var(--surface-container-high)',
                      border: 'none',
                      padding: 0,
                    }}
                    aria-label={`Open ${photo.activity_name}`}
                  >
                    <img
                      src={photo.url}
                      alt={photo.activity_name}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 px-2 pt-4 pb-1.5"
                      style={{
                        background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                        color: 'white',
                      }}
                    >
                      <div className="flex items-center gap-1 text-[10px] font-bold">
                        <Heart size={10} fill="currentColor" />
                        <span>{photo.likeCount}</span>
                        <MessageCircle size={10} className="ml-1.5" />
                        <span>{photo.commentCount}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Trips (own only) */}
          {isOwn && (
            <section>
              <h2 className={sectionLabelClass} style={{ color: 'var(--text-tertiary)' }}>
                My trips
              </h2>
              {tripsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="activity-card-shimmer rounded-2xl h-16"
                      style={{ background: 'var(--surface-container-high)' }}
                    />
                  ))}
                </div>
              ) : trips.length === 0 ? (
                <div
                  className="rounded-2xl px-4 py-6 text-center"
                  style={{ background: 'var(--surface-container)', color: 'var(--text-secondary)' }}
                >
                  <Plane size={20} className="mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                  <p className="text-[13px] font-bold">No saved trips</p>
                  <p className="text-[12px] mt-1">Plan a trip and save it to the cloud.</p>
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-container)' }}>
                  {trips.map((trip, idx) => (
                    <button
                      key={trip.id}
                      onClick={() => handleLoadTrip(trip.id)}
                      disabled={loadingTripId === trip.id}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors disabled:opacity-60"
                      style={{
                        borderBottom: idx === trips.length - 1 ? 'none' : '0.33px solid var(--outline)',
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
                      >
                        <MapPin size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-bold truncate">{trip.title}</div>
                        <div className="text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>
                          {(trip.cities || []).join(' · ') || 'No cities yet'}
                        </div>
                      </div>
                      <span
                        className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                        style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
                      >
                        {loadingTripId === trip.id ? 'Loading...' : 'Open'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Sign out (own only) */}
          {isOwn && user && (
            <section>
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-container)' }}>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--surface-container-high)', color: 'var(--text-primary)' }}
                  >
                    <LogOut size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold">Sign out</div>
                    <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                      {profile?.email || 'Signed in'}
                    </div>
                  </div>
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      <PhotoViewerModal
        photo={openPhoto}
        uploaderId={targetId}
        onClose={() => setOpenPhotoId(null)}
        onLikeChange={(photoId, delta) => {
          setPhotos((rows) =>
            rows.map((row) =>
              row.id === photoId ? { ...row, likeCount: Math.max(0, row.likeCount + delta) } : row,
            ),
          );
          setStats((s) => ({ ...s, likesReceived: Math.max(0, s.likesReceived + delta) }));
        }}
        onCommentAdded={(photoId) => {
          setPhotos((rows) =>
            rows.map((row) =>
              row.id === photoId ? { ...row, commentCount: row.commentCount + 1 } : row,
            ),
          );
          setStats((s) => ({ ...s, commentsReceived: s.commentsReceived + 1 }));
        }}
      />
    </div>
  );
};

export default ProfilePage;
