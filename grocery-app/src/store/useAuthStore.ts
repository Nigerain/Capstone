import { create } from 'zustand';

import type { AuthUser } from '../services/auth';

// Who is signed in, or null when signed out.
// With Firebase (EXPO_PUBLIC_USE_MOCK_DATA=false), Firebase remembers the
// session and App.tsx copies it in here through watchAuthUser.
// In mock mode it's in memory only: sign in again after the app restarts.
type AuthState = {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

// Scanning and submitting prices need sign-in: the backend rejects both
// without a token (401).
export function canAddPrices(): boolean {
  return useAuthStore.getState().user !== null;
}
