import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { searchItems } from '../services/priceService';

export function useSearchItems(query: string) {
  const trimmed = query.trim();

  return useQuery({
    // Lowercased so "Chicken" and "chicken" share one cached result.
    queryKey: ['items', 'search', trimmed.toLowerCase()],
    queryFn: () => searchItems(trimmed),
    enabled: trimmed.length > 0,
    // While a new search loads, keep showing the previous results instead of a blank list.
    placeholderData: keepPreviousData,
    // Reuse a result for 1 minute before searching again.
    staleTime: 60_000,
  });
}