import { useQuery } from '@tanstack/react-query';

import { getPriceDrops } from '../services/priceService';

// Price drops near the user, biggest first. Only this hook's queryFn
// needs to change when the real backend endpoint is ready.
export function usePriceDrops() {
  return useQuery({
    queryKey: ['priceDrops'],
    queryFn: getPriceDrops,
    // Reuse the list for 5 minutes before asking again.
    staleTime: 5 * 60_000,
  });
}
