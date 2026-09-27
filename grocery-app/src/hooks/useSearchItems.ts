import { useQuery } from '@tanstack/react-query';
import { searchItems } from '../services/priceService';

export function useSearchItems(query: string) {
  return useQuery({
    queryKey: ['items', 'search', query],
    queryFn: () => searchItems(query),
    enabled: query.trim().length > 0,
  });
}