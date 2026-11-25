import { useQuery } from '@tanstack/react-query';

import { getMyActivity } from '../services/activityService';
import { useAuthStore } from '../store/useAuthStore';

// The Activity tab's prices and counts. Keyed by uid, so a different
// account never sees the previous one's prices. Off while signed out.
export function useMyActivity() {
  const uid = useAuthStore((s) => s.user?.uid);
  return useQuery({
    queryKey: ['myActivity', uid],
    queryFn: () => getMyActivity(uid as string),
    enabled: !!uid,
    staleTime: 30_000,
  });
}
