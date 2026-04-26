import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listMyTrips } from '../services/tripsService';
import type { Trip } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';

export interface MyTripsState {
  trips: Trip[];
  loading: boolean;
}

export function useMyTrips(userId: string | null): MyTripsState {
  const query = useQuery({
    queryKey: queryKeys.myTrips(userId),
    queryFn: () => listMyTrips(userId as string),
    enabled: Boolean(userId),
    placeholderData: (prev) => prev,
  });
  return {
    trips: query.data ?? [],
    loading: query.isPending && Boolean(userId),
  };
}

export function useInvalidateMyTrips() {
  const qc = useQueryClient();
  return (userId: string) => qc.invalidateQueries({ queryKey: queryKeys.myTrips(userId) });
}
