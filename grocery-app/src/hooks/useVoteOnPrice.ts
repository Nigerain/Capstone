import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  isOwnPrice,
  removeVote,
  submitVote,
  voteErrorMessage,
  type Vote,
} from '../services/voteService';
import { useAuthStore } from '../store/useAuthStore';
import { useVoteStore } from '../store/useVoteStore';
import type { Price } from '../types/price';

export type PendingVote = Vote | 'undo' | null;

// Everything about the signed-in user's vote on one price, shared by the
// thumbs pill (Product Detail, Compare Prices rows) and the vote sheet, so a
// vote cast in one place shows up in the others right away.
export function useVoteOnPrice(price: Price) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const override = useVoteStore((s) => s.votes[price.id]);
  const setVote = useVoteStore((s) => s.setVote);

  const [pending, setPending] = useState<PendingVote>(null);
  const [error, setError] = useState<string | null>(null);

  // This session's vote wins over what the data says, until the item reloads.
  const original = price.myVote ?? null;
  const myVote = override !== undefined ? override : original;

  // Counts as the backend sent them, adjusted for a vote it hasn't seen yet.
  const confirmed = adjust(
    price.confirmCount ?? 0,
    original === 'up',
    myVote === 'up'
  );
  const disputed = adjust(
    price.disputeCount ?? 0,
    original === 'down',
    myVote === 'down'
  );

  // Resolves to null when the vote was saved, or the error message if not.
  const run = async (next: PendingVote): Promise<string | null> => {
    setError(null);
    setPending(next);
    try {
      if (next === 'undo') await removeVote(price.id);
      else if (next) await submitVote(price.id, next);
      setVote(price.id, next === 'undo' ? null : next);
      // Counts on the product page and in search are now out of date.
      queryClient.invalidateQueries({ queryKey: ['items'] });
      return null;
    } catch (e) {
      const message = voteErrorMessage(e);
      setError(message);
      return message;
    } finally {
      setPending(null);
    }
  };

  // Thumbs pill: tapping the thumb you already picked takes the vote back.
  const toggle = (vote: Vote) => run(myVote === vote ? 'undo' : vote);

  return {
    myVote,
    confirmed,
    disputed,
    pending,
    error,
    isOwn: isOwnPrice(price, user),
    run,
    toggle,
  };
}

// A count from the backend, plus or minus a vote it hasn't counted yet.
function adjust(
  count: number,
  wasCounted: boolean,
  isCounted: boolean
): number {
  return Math.max(0, count - (wasCounted ? 1 : 0) + (isCounted ? 1 : 0));
}
