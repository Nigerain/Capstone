import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';

import { getItemById } from '../services/priceService';
import type { Item } from '../types/price';

// Look through every cached search result for this item.
function findInSearchCache(queryClient: QueryClient, itemId: string): Item | undefined {
  const searches = queryClient.getQueriesData<Item[]>({ queryKey: ['items', 'search'] });
  for (const [, items] of searches) {
    const match = items?.find((item) => item.id === itemId);
    if (match) return match;
  }
  return undefined;
}

export function useItem(itemId: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['items', 'detail', itemId],
    queryFn: () => getItemById(itemId),
    staleTime: 60_000,
    // Show the item instantly if a search already loaded it.
    initialData: () => findInSearchCache(queryClient, itemId),
  });
}