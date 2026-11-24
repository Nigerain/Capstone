import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useSyncExternalStore } from 'react';

const MAX_RECENT = 5;

type SearchState = {
  recentSearches: string[]; // newest first
  addRecentSearch: (term: string) => void;
  removeRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
};

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      recentSearches: [],

      addRecentSearch: (term) =>
        set((state) => {
          const cleaned = term.trim();
          if (!cleaned) return state; // ignore empty searches

          // Remove any earlier copy (ignoring capitals), put it first, keep the newest 5.
          const others = state.recentSearches.filter(
            (t) => t.toLowerCase() !== cleaned.toLowerCase(),
          );
          return { recentSearches: [cleaned, ...others].slice(0, MAX_RECENT) };
        }),

      removeRecentSearch: (term) =>
        set((state) => ({
          recentSearches: state.recentSearches.filter((t) => t !== term),
        })),

      clearRecentSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: 'search-store', // the key it's saved under on the phone
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ recentSearches: state.recentSearches }),
      // Bump this if the saved shape ever changes, so old saved data can be migrated.
      version: 1,
    },
  ),
);

function subscribeToHydration(notify: () => void) {
  const start = useSearchStore.persist.onHydrate(notify);
  const finish = useSearchStore.persist.onFinishHydration(notify);
  return () => { start(); finish(); };
}

export function useSearchStoreHydrated(): boolean {
  return useSyncExternalStore(subscribeToHydration,
    () => useSearchStore.persist.hasHydrated(), () => false);
}
