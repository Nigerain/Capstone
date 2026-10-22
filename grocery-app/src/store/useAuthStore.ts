import { create } from 'zustand';

import type { AuthUser } from '../services/auth';

// Who is signed in, or null when signed out.
// In memory only for now: signing up again is needed after the app restarts.
// Once Firebase Auth is connected, Firebase remembers the session and this mirrors it.
type AuthState = {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
