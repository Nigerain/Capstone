import { create } from 'zustand';

const MAX_RECENT = 5;

type SearchState = {
  recentSearches: string[]; // newest first
  addRecentSearch: (term: string) => void;
  removeRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
};

export const useSearchStore = create<SearchState>()((set) => ({
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
}));