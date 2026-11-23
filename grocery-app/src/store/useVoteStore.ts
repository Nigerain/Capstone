import { create } from 'zustand';

import type { Vote } from '../services/voteService';

// Votes cast (or undone) in this session, by price id. They override what the
// price data says (Price.myVote), so the sheet stays right when it's reopened
// before the item reloads. undefined = no change this session; null = undone.
type VoteState = {
  votes: Record<string, Vote | null>;
  setVote: (priceId: string, vote: Vote | null) => void;
};

export const useVoteStore = create<VoteState>()((set) => ({
  votes: {},
  setVote: (priceId, vote) =>
    set((state) => ({ votes: { ...state.votes, [priceId]: vote } })),
}));
