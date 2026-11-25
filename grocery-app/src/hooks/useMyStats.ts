import { useQuery } from '@tanstack/react-query';

import { getMyStats } from '../services/statsService';
import { useAuthStore } from '../store/useAuthStore';

// The signed-in user's trust score, for the Profile tab. Keyed by uid, so a
// different account never sees the previous one's stats.
export function useMyStats() {
  const uid = useAuthStore((s) => s.user?.uid);
  return useQuery({
    queryKey: ['myStats', uid],
    queryFn: getMyStats,
    enabled: !!uid,
    staleTime: 60_000,
  });
}
