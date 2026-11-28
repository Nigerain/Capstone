import { useQuery } from '@tanstack/react-query';

import { groupIntoShelves } from '../constants/categories';
import { getCategoryItems } from '../services/priceService';
import type { Category } from '../types/price';

/**
 * A category's items, already sorted onto shelves (Milk, Eggs, …).
 * The key starts with 'items', so submitting a price (useSubmitPrice)
 * refreshes the category screens too.
 */
export function useCategoryShelves(category: Category) {
  return useQuery({
    queryKey: ['items', 'category', category],
    queryFn: () => getCategoryItems(category),
    select: (items) => groupIntoShelves(category, items),
    staleTime: 60_000,
  });
}
