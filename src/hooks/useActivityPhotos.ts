import { useEffect, useRef } from 'react';
import { useTravel } from '../contexts/TravelContext';
import { fetchPhotosForActivities } from '../services/placePhotoService';
import { pruneExpiredCache } from '../services/imageCacheService';

export function useActivityPhotos() {
  const { activities, setActivities, currentPlan } = useTravel();
  const fetchingRef = useRef(false);
  const activitiesRef = useRef(activities);

  activitiesRef.current = activities;

  useEffect(() => {
    if (!currentPlan || activities.length === 0) return;
    if (fetchingRef.current) return;

    const seg = currentPlan.segments?.[0];
    const dest = currentPlan.destination || currentPlan.destinations?.[0];
    const cityName = seg?.city?.name || dest?.name || '';
    if (!cityName) return;

    const needsPhotos = activities
      .map((a, i) => ({ name: a.name, cityName, index: i }))
      .filter((_, i) => !activities[i].imageUrl);

    if (needsPhotos.length === 0) return;

    fetchingRef.current = true;

    let pendingUpdates: Array<{ index: number; imageUrl: string; imageUrls: string[]; placeId: string | null }> = [];
    let batchTimeout: ReturnType<typeof setTimeout> | null = null;

    const flushUpdates = () => {
      if (pendingUpdates.length === 0) return;
      const updates = [...pendingUpdates];
      pendingUpdates = [];

      const current = [...activitiesRef.current];
      let changed = false;
      for (const u of updates) {
        if (current[u.index] && !current[u.index].imageUrl) {
          current[u.index] = {
            ...current[u.index],
            imageUrl: u.imageUrl,
            imageUrls: u.imageUrls,
            placeId: u.placeId || undefined,
          };
          changed = true;
        }
      }
      if (changed) {
        setActivities(current);
      }
    };

    // Prune expired image blobs on startup
    pruneExpiredCache();

    fetchPhotosForActivities(
      needsPhotos,
      (index, result) => {
        pendingUpdates.push({
          index,
          imageUrl: result.imageUrl!,
          imageUrls: result.imageUrls,
          placeId: result.placeId,
        });
        if (batchTimeout) clearTimeout(batchTimeout);
        batchTimeout = setTimeout(flushUpdates, 500);
        // No eager prefetch — the cover URL is loaded lazily by <CachedImage>
        // when its card scrolls into view, and the rest of the carousel only
        // fetches when the user explicitly opens it. Eager prefetch was the
        // single biggest line on the Places Photo bill.
      },
      3
    ).then(() => {
      flushUpdates();
      fetchingRef.current = false;
    }).catch(() => {
      fetchingRef.current = false;
    });

    return () => {
      if (batchTimeout) clearTimeout(batchTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlan, activities.length]);
}
