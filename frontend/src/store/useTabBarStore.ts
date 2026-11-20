import { create } from 'zustand';

// Whether the bottom tab bar is tucked away because the user scrolled down.
type TabBarState = {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
};

export const useTabBarStore = create<TabBarState>()((set) => ({
  hidden: false,
  setHidden: (hidden) => set({ hidden }),
}));
