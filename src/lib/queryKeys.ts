// Centralized React Query key factory. One source of truth so a
// mutation's invalidation target always matches a hook's read key.
// Pattern: every key is an array; the leading literal namespaces the
// surface, the trailing values discriminate per user / per activity.
export const queryKeys = {
  profileMedia: (userId: string | null) => ['profile-media', userId] as const,
  myTrips: (userId: string | null) => ['my-trips', userId] as const,
  activityMedia: (key: unknown, viewerId: string | null) =>
    ['activity-media', key, viewerId] as const,
  savedPlaces: (userId: string | null) => ['saved-places', userId] as const,
  savedPlaceIds: (userId: string | null) => ['saved-place-ids', userId] as const,
};
