import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getNearbyStores } from '../services/storeService';

// Nearby stores for the Store Picker. An empty query lists them all.
export function useStores(query: string) {
  const trimmed = query.trim().toLowerCase();

  return useQuery({
    queryKey: ['stores', 'nearby', trimmed],
    queryFn: () => getNearbyStores(trimmed),
    // Keep the old list on screen while a new search loads.
    placeholderData: keepPreviousData,
    // Stores rarely change; reuse the list for 5 minutes.
    staleTime: 5 * 60_000,
  });
}
