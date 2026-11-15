import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Store } from '../types/price';

// Choices from the Profile tab's settings list. Saved on the phone only:
// the users table has no columns for these yet.
export const SEARCH_RADIUS_OPTIONS = [1, 2, 5, 10] as const; // miles
export type SearchRadius = (typeof SEARCH_RADIUS_OPTIONS)[number];

type SettingsState = {
  homeStore: Pick<Store, 'id' | 'name'> | null;
  // TODO(location): search doesn't filter by distance yet. Use this once
  // Dixon's distance code (layout branch) reaches the search endpoint.
  searchRadiusMi: SearchRadius;
  setHomeStore: (store: Store) => void;
  setSearchRadius: (miles: SearchRadius) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      homeStore: null,
      searchRadiusMi: 2,
      // Only the id and name are kept: distance and hours go stale.
      setHomeStore: (store) =>
        set({ homeStore: { id: store.id, name: store.name } }),
      setSearchRadius: (searchRadiusMi) => set({ searchRadiusMi }),
    }),
    {
      name: 'settings-store', // the key it's saved under on the phone
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        homeStore: state.homeStore,
        searchRadiusMi: state.searchRadiusMi,
      }),
      // Bump this if the saved shape ever changes, so old saved data can be migrated.
      version: 1,
    }
  )
);
