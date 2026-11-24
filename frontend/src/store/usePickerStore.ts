import { create } from 'zustand';

import type { Store } from '../types/price';

// Keep selected store while the price form is open
type PickerState = {
  store: Store | null;
  setStore: (store: Store) => void;
  clear: () => void;
};

export const usePickerStore = create<PickerState>()((set) => ({
  store: null,
  setStore: (store) => set({ store }),
  clear: () => set({ store: null }),
}));
