import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  ChevronLeft,
  ChevronUp,
  Heart,
  Image as ImageIcon,
  MapPin,
  LogOut,
  MessageCircle,
  Play,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PreferencesEditor from './PreferencesEditor';
import { useToast } from '../contexts/ToastContext';
import { useTravel } from '../contexts/TravelContext';
import { supabase, PROFILE_COLUMNS, type Profile, type Trip } from '../lib/supabase';
import { type UserPhoto } from '../services/activityMediaService';
import { type UserVideo } from '../services/activityVideoService';
import { useProfileMedia } from '../hooks/useProfileMedia';
import { loadTrip } from '../services/tripsService';
import { useMyTrips, invalidateMyTrips } from '../hooks/useMyTrips';
import Avatar from './Avatar';
import CachedImage from './CachedImage';
import ProfileMediaViewer, { type MediaItem } from './ProfileMediaViewer';
import TripsBento from './TripsBento';
import VideoThumbnail from './VideoThumbnail';
import { thumbhashToCssDataUrl } from '../lib/thumbhash';

// Unified grid item for the profile media wall. Image and video rows
// have different shapes in the DB; the discriminator lets the grid
// render each correctly without forcing one schema to fit the other.
type ProfileMediaItem = MediaItem;

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routeUserId = useMemo(() => {
    const match = location.pathname.match(/^\/profile\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);
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

  const isOwn = !routeUserId || (user?.id ? routeUserId === user.id : false);
  const targetId = isOwn ? user?.id ?? null : routeUserId ?? null;

  const [profile, setProfile] = useState<Profile | null>(isOwn ? ownProfile : null);
  const [profileLoading, setProfileLoading] = useState(!isOwn);
  // SWR-cached profile media: instant render on revisit, background refresh
  // when the entry is older than the cache TTL. Replaces the three useState
  // calls + Promise.all that re-fired on every mount.
  const { stats, photos, videos, loading: photosLoading } = useProfileMedia(targetId);
  // Cached trips list, same SWR pattern. Returning to the profile no
  // longer flashes the trip carousel through a fresh fetch.
  const { trips, loading: tripsLoading } = useMyTrips(isOwn && user ? user.id : null);
  const [loadingTripId, setLoadingTripId] = useState<string | null>(null);
  const [openMediaKey, setOpenMediaKey] = useState<string | null>(null);

  // Merge into one chronological grid. Done here (rather than in state)
  // so optimistic updates to either array re-merge automatically.
  const mediaItems = useMemo<ProfileMediaItem[]>(() => {
    const items: ProfileMediaItem[] = [
      ...photos.map<ProfileMediaItem>((data) => ({ kind: 'image', data })),
      ...videos.map<ProfileMediaItem>((data) => ({ kind: 'video', data })),
    ];
    items.sort((a, b) => (a.data.created_at < b.data.created_at ? 1 : -1));
    return items;
  }, [photos, videos]);

  useEffect(() => {
    if (isOwn) setProfile(ownProfile);
  }, [isOwn, ownProfile]);

  useEffect(() => {
    if (isOwn || !routeUserId) return;
    setProfileLoading(true);
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', routeUserId!)
        .maybeSingle();
      if (!alive) return;
      setProfile(data ?? null);
      setProfileLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [isOwn, routeUserId]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/trip');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const handleLoadTrip = async (tripIdOrTrip: string | Trip) => {
    const tripId = typeof tripIdOrTrip === 'string' ? tripIdOrTrip : tripIdOrTrip.id;
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
    navigate('/trip');
  };

  const handlePhotoTap = (photo: UserPhoto) => {
    setOpenMediaKey(`image-${photo.id}`);
  };

  const handleVideoTap = (video: UserVideo) => {
    setOpenMediaKey(`video-${video.id}`);
  };

  const openIndex = openMediaKey
    ? mediaItems.findIndex((m) => `${m.kind}-${m.data.id}` === openMediaKey)
    : -1;
  const initialIndex = openIndex >= 0 ? openIndex : null;

  const displayName = profile?.display_name || 'Traveler';
  const influence = profile?.influence ?? 0;

  const sectionLabelClass = 'text-[11px] font-bold uppercase tracking-[0.12em] px-1 mb-2';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
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

      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: 'calc(4rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
        }}
      >
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
                <div className="text-[21px] font-extrabold tracking-tight truncate leading-tight">
                  {profileLoading ? 'Loading...' : displayName}
                </div>
                <div
                  className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold"
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

            {/* A bento rather than a row of matching cards: tiles of
                different weights, so the eye is told what matters instead of
                being handed four equal boxes.

                Each tile reads mark-and-number on one line, then what it
                counts underneath, the number is the thing being said, and
                the icon belongs beside it rather than stacked above it. */}
            <div
              className="relative grid gap-2 mt-4"
              style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
            >
              {/* Places leads: where you have been is the thing worth saying. */}
              <div
                className="rounded-2xl p-3.5"
                style={{
                  gridColumn: 'span 2',
                  background:
                    'linear-gradient(150deg, color-mix(in srgb, var(--accent) 22%, var(--surface-container-high)) 0%, var(--surface-container-high) 70%)',
                }}
              >
                <div className="flex items-center gap-2">
                  <MapPin size={18} style={{ color: 'var(--accent)' }} />
                  <span className="text-[30px] font-extrabold leading-none tracking-tight">
                    {stats.placesContributed}
                  </span>
                </div>
                <div className="text-[11px] font-bold mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                  {stats.placesContributed === 1 ? 'place you put on the map' : 'places you put on the map'}
                </div>
              </div>

              {/* Contributions: the act, named as the act. */}
              <div className="rounded-2xl p-3.5" style={{ background: 'var(--surface-container-high)' }}>
                <div className="flex items-center gap-2">
                  <ImageIcon size={16} style={{ color: 'var(--accent)' }} />
                  <span className="text-[24px] font-extrabold leading-none tracking-tight">
                    {stats.postCount}
                  </span>
                </div>
                <div className="text-[10.5px] font-bold mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  contributions
                </div>
              </div>

              {/* Likes: what the contributions earned. */}
              <div className="rounded-2xl p-3.5" style={{ background: 'var(--surface-container-high)' }}>
                <div className="flex items-center gap-2">
                  <Heart size={16} style={{ color: 'var(--accent)' }} />
                  <span className="text-[24px] font-extrabold leading-none tracking-tight">
                    {stats.likesReceived}
                  </span>
                </div>
                <div className="text-[10.5px] font-bold mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  likes
                </div>
              </div>

              {/* Votes cast: the contribution nobody sees you make. */}
              <div
                className="rounded-2xl p-3.5"
                style={{ gridColumn: 'span 2', background: 'var(--surface-container-high)' }}
              >
                <div className="flex items-center gap-2">
                  <ChevronUp size={18} style={{ color: 'var(--accent)' }} />
                  <span className="text-[24px] font-extrabold leading-none tracking-tight">
                    {stats.votesCast}
                  </span>
                </div>
                <div className="text-[10.5px] font-bold mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  votes cast on other people's finds
                </div>
              </div>
            </div>

            {/* What this person likes, in the badge, because it is part of
                who they are rather than a setting. */}
            {isOwn && user?.id && (
              <div
                className="relative mt-2 rounded-2xl p-3.5"
                style={{ background: 'var(--surface-container-high)' }}
              >
                <PreferencesEditor userId={user.id} />
              </div>
            )}
          </div>

          {/* Contributions */}
          <section>
            <h2 className={sectionLabelClass} style={{ color: 'var(--text-tertiary)' }}>
              {isOwn ? 'My contributions' : 'Contributions'}
            </h2>
            {isOwn && !photosLoading && mediaItems.length > 0 && (
              <p className="text-[12px] mb-2.5" style={{ color: 'var(--text-secondary)' }}>
                {stats.placesContributed === 1
                  ? 'One place is on the map because of you.'
                  : `${stats.placesContributed} places are on the map because of you.`}
              </p>
            )}
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
            ) : mediaItems.length === 0 ? (
              <div
                className="rounded-2xl px-4 py-6 text-center"
                style={{ background: 'var(--surface-container)', color: 'var(--text-secondary)' }}
              >
                <ImageIcon size={20} className="mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-[13px] font-bold">
                  {isOwn ? 'No posts yet' : 'Nothing posted yet'}
                </p>
                <p className="text-[12px] mt-1">
                  {isOwn ? 'Tap the plus button on a place to share a photo or video.' : ' '}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {mediaItems.map((item) => {
                  if (item.kind === 'image') {
                    const photo = item.data;
                    const placeholder = thumbhashToCssDataUrl(photo.thumbhash);
                    return (
                      <button
                        key={`image-${photo.id}`}
                        onClick={() => handlePhotoTap(photo)}
                        className="relative overflow-hidden rounded-xl transition-transform active:scale-95"
                        style={{
                          aspectRatio: '1 / 1',
                          background: placeholder
                            ? `center / cover no-repeat url(${placeholder})`
                            : 'var(--surface-container-high)',
                          border: 'none',
                          padding: 0,
                        }}
                        aria-label={`Open ${photo.activity_name}`}
                      >
                        <CachedImage
                          src={photo.url}
                          alt={photo.activity_name}
                          loading="lazy"
                          decoding="async"
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
                    );
                  }
                  // Video tile, same square thumbnail shape as photos, with
                  // the trim-start poster and a Play badge so the tile reads
                  // as video at a glance.
                  const video = item.data;
                  const placeholder = thumbhashToCssDataUrl(video.thumbhash);
                  return (
                    <button
                      key={`video-${video.id}`}
                      onClick={() => handleVideoTap(video)}
                      className="relative overflow-hidden rounded-xl transition-transform active:scale-95"
                      style={{
                        aspectRatio: '1 / 1',
                        background: placeholder
                          ? `center / cover no-repeat url(${placeholder})`
                          : 'var(--surface-container-high)',
                        border: 'none',
                        padding: 0,
                      }}
                      aria-label={`Open video from ${video.activity_name}`}
                    >
                      <VideoThumbnail
                        videoUrl={video.url}
                        posterUrl={video.posterUrl}
                        alt={video.activity_name}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {/* Play badge top-right */}
                      <div
                        aria-hidden="true"
                        className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full"
                        style={{
                          width: 22,
                          height: 22,
                          background: 'rgba(0,0,0,0.55)',
                          backdropFilter: 'blur(6px)',
                          WebkitBackdropFilter: 'blur(6px)',
                          color: 'white',
                        }}
                      >
                        <Play size={11} fill="currentColor" />
                      </div>
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
                          <span>{video.likeCount}</span>
                          <MessageCircle size={10} className="ml-1.5" />
                          <span>{video.commentCount}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Trips (own only) */}
          {isOwn && (
            <section>
              <h2 className={sectionLabelClass} style={{ color: 'var(--text-tertiary)' }}>
                My trips {trips.length > 0 && <span style={{ opacity: 0.7 }}>({trips.length})</span>}
              </h2>
              {tripsLoading ? (
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
                  aria-hidden="true"
                >
                  {/* The same tiles, in the same grid, so nothing jumps when
                      the real ones arrive. */}
                  <div
                    className="activity-card-shimmer rounded-2xl"
                    style={{ gridColumn: 'span 2', minHeight: '6.5rem', background: 'var(--surface-container-high)' }}
                  />
                  <div
                    className="activity-card-shimmer rounded-2xl"
                    style={{ minHeight: '6.5rem', background: 'var(--surface-container-high)' }}
                  />
                </div>
              ) : (
                <TripsBento
                  trips={trips}
                  activeTripId={profile?.current_trip_id ?? null}
                  onSelect={handleLoadTrip}
                  onPlanTrip={() => navigate('/new-trip')}
                  busyTripId={loadingTripId}
                />
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
                      {user?.email || 'Signed in'}
                    </div>
                  </div>
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      <ProfileMediaViewer
        media={mediaItems}
        initialIndex={initialIndex}
        uploaderId={targetId}
        onClose={() => setOpenMediaKey(null)}
        onLikeChange={(id, kind, delta) => {
          if (kind === 'image') {
            setPhotos((rows) =>
              rows.map((row) =>
                row.id === id ? { ...row, likeCount: Math.max(0, row.likeCount + delta) } : row,
              ),
            );
          } else {
            setVideos((rows) =>
              rows.map((row) =>
                row.id === id ? { ...row, likeCount: Math.max(0, row.likeCount + delta) } : row,
              ),
            );
          }
          setStats((s) => ({ ...s, likesReceived: Math.max(0, s.likesReceived + delta) }));
        }}
        onMediaDeleted={(id, kind) => {
          if (kind === 'image') {
            const removed = photos.find((p) => p.id === id);
            setPhotos((rows) => rows.filter((row) => row.id !== id));
            setStats((s) => ({
              postCount: Math.max(0, s.postCount - 1),
              likesReceived: Math.max(0, s.likesReceived - (removed?.likeCount ?? 0)),
              commentsReceived: Math.max(0, s.commentsReceived - (removed?.commentCount ?? 0)),
            }));
          } else {
            const removed = videos.find((v) => v.id === id);
            setVideos((rows) => rows.filter((row) => row.id !== id));
            setStats((s) => ({
              postCount: Math.max(0, s.postCount - 1),
              likesReceived: Math.max(0, s.likesReceived - (removed?.likeCount ?? 0)),
              commentsReceived: Math.max(0, s.commentsReceived - (removed?.commentCount ?? 0)),
            }));
          }
          setOpenMediaKey(null);
        }}
        onCommentAdded={(id, kind) => {
          if (kind === 'image') {
            setPhotos((rows) =>
              rows.map((row) =>
                row.id === id ? { ...row, commentCount: row.commentCount + 1 } : row,
              ),
            );
          } else {
            setVideos((rows) =>
              rows.map((row) =>
                row.id === id ? { ...row, commentCount: row.commentCount + 1 } : row,
              ),
            );
          }
          setStats((s) => ({ ...s, commentsReceived: s.commentsReceived + 1 }));
        }}
      />
    </div>
  );
};

export default ProfilePage;
