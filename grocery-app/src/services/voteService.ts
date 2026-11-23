import type { AuthUser } from './auth';
import { ApiError, apiRequest } from './api';
import { getAuthToken } from './auth';
import type { Price } from '../types/price';

// Voting has its own switch, like scanning and submitting: the FastAPI vote
// routes aren't written yet (backend/app/api/votes.py is empty), even though
// Dixon's SubmitPriceVote / RemovePriceVote mutations exist.
// Mock unless .env explicitly says false.
// Changing it needs a restart with a cleared cache: npx expo start -c
export const USE_MOCK_VOTES =
  process.env.EXPO_PUBLIC_USE_MOCK_VOTES !== 'false';

export type Vote = 'up' | 'down';

// PROPOSED routes (to agree on with Ceren and Dixon):
//   POST   /api/v1/votes            { priceRecordId, isUpvote }  → SubmitPriceVote
//   DELETE /api/v1/votes/{priceId}                               → RemovePriceVote
// Voting again on the same price changes the vote (the mutation upserts).

/** Saves the user's vote on a price. Throws ApiError on any failure. */
export async function submitVote(priceId: string, vote: Vote): Promise<void> {
  if (USE_MOCK_VOTES) return mockRequest();
  const token = await requireToken();
  await apiRequest('/api/v1/votes', {
    method: 'POST',
    body: { priceRecordId: priceId, isUpvote: vote === 'up' },
    token,
  });
}

/** Takes the user's vote back ("Undo my vote"). */
export async function removeVote(priceId: string): Promise<void> {
  if (USE_MOCK_VOTES) return mockRequest();
  const token = await requireToken();
  await apiRequest(`/api/v1/votes/${encodeURIComponent(priceId)}`, {
    method: 'DELETE',
    token,
  });
}

/**
 * True when the signed-in user posted this price, so the sheet shows
 * "Your price" instead of the vote buttons (the backend refuses those votes).
 * Mock data has no user ids, so in mock mode Ada's prices count as yours.
 */
export function isOwnPrice(price: Price, user: AuthUser | null): boolean {
  if (USE_MOCK_VOTES) return price.submittedBy === 'Ada';
  return !!user && !!price.submitterId && price.submitterId === user.uid;
}

/** Turns a failed vote into a message for the sheet. Nothing was saved. */
export function voteErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return 'Log in to vote on prices.';
    }
    // The mutation's @check fails for private, inactive or your own prices.
    if (error.status === 400 || error.status === 409 || error.status === 422) {
      return 'You can’t vote on this price.';
    }
    if (error.status === 0) {
      return 'Couldn’t reach the server. Check your connection and try again.';
    }
  }
  return 'Something went wrong, so your vote wasn’t saved. Try again.';
}

async function requireToken(): Promise<string> {
  const token = await getAuthToken();
  if (!token) throw new ApiError('Sign in is required to vote.', 401);
  return token;
}

async function mockRequest(): Promise<void> {
  // Long enough to see the button's spinner.
  await new Promise((resolve) => setTimeout(resolve, 500));
}
