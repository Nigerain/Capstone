import { create } from 'zustand';

import type { Store } from '../types/price';

// The store chosen on the Store Picker. The price form reads it when it
// comes back into view, so the picker doesn't pass anything back through
// navigation. The price form clears it when it closes, so a new price
// starts fresh.
type PickerState = {
  store: Store | null;
  // 'guess' = filled in from location, so the form shows "Guessed from your
  // location"; 'user' = picked on the Store Picker.
  storeSource: 'guess' | 'user' | null;
  setStore: (store: Store, source: 'guess' | 'user') => void;
  clear: () => void;
};

export const usePickerStore = create<PickerState>()((set) => ({
  store: null,
  storeSource: null,
  setStore: (store, storeSource) => set({ store, storeSource }),
  clear: () => set({ store: null, storeSource: null }),
}));
