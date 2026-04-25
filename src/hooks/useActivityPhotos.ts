import { useEffect, useRef } from 'react';
import { useTravel } from '../contexts/TravelContext';
import { useAuth } from '../contexts/AuthContext';
import { ensureActivity, listActivityImageUrls } from '../services/activityMediaService';
import { warmImageCache } from '../lib/imagePrefetch';

export function useActivityPhotos() {
  const { activities, setActivities, currentPlan } = useTravel();
  const { user } = useAuth();
  const runningRef = useRef(false);
  const activitiesRef = useRef(activities);
  activitiesRef.current = activities;

  useEffect(() => {
    if (!currentPlan || activities.length === 0) return;
    if (runningRef.current) return;

    const seg = currentPlan.segments?.[0];
    const dest = currentPlan.destination || currentPlan.destinations?.[0];
    const cityName = seg?.city?.name || dest?.name || '';
    const country = seg?.destination?.country || dest?.country || null;
    if (!cityName) return;

    const needs = activities
      .map((a, i) => ({ activity: a, index: i }))
      .filter(({ activity }) => !activity.imageUrls || activity.imageUrls.length === 0);

    if (needs.length === 0) return;

    runningRef.current = true;
    const createdBy = user?.id ?? null;

    (async () => {
      const pending: Array<{ index: number; urls: string[]; dbActivityId: string }> = [];
      for (const { activity, index } of needs) {
        const dbActivity = await ensureActivity(
          {
            name: activity.name,
            city: cityName,
            country,
            address: activity.formattedAddress || activity.location || null,
            lat: activity.coordinates?.lat ?? null,
            lng: activity.coordinates?.lng ?? null,
            googlePlaceId: activity.placeId || null,
          },
          createdBy
        );
        if (!dbActivity) continue;
        const urls = await listActivityImageUrls(dbActivity.id);
        warmImageCache(urls);
        pending.push({ index, urls, dbActivityId: dbActivity.id });
      }

      const current = [...activitiesRef.current];
      let changed = false;
      for (const p of pending) {
        if (!current[p.index]) continue;
        current[p.index] = {
          ...current[p.index],
          imageUrl: p.urls[0] || undefined,
          imageUrls: p.urls,
          dbActivityId: p.dbActivityId,
        };
        changed = true;
      }
      if (changed) setActivities(current);
      runningRef.current = false;
    })().catch((err) => {
      console.error('useActivityPhotos failed', err);
      runningRef.current = false;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlan, activities.length, user?.id]);
}
