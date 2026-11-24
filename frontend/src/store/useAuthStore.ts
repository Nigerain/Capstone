import { create } from 'zustand';

import type { AuthUser } from '../services/auth';

// Who is signed in, or null when signed out.
// Firebase remembers the session; App.tsx copies it here through watchAuthUser.
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
