// The signed-in user's trust score, for the Profile tab's trust score card.
export type MyStats = {
  // 0 to 1. Dixon's submitter reputation: how shoppers voted on this
  // user's prices, with a neutral start for new users.
  trustScore: number;
};

// TODO(backend): no endpoint returns this yet, so it's mock data in every
// mode. GET /users/{user_id}/stats (backend/app/api/users.py) returns only
// `user` and `totalSubmissions` today. Ask Dixon to add a `trustScore` field
// from calculate_reputation_from_history() in
// backend/app/services/submitter_reputation.py, then call it here with
// apiGet(..., await getAuthToken()) and map the response to MyStats.
export async function getMyStats(): Promise<MyStats> {
  // Pretend to talk to a server so the loading state is visible.
  await new Promise((resolve) => setTimeout(resolve, 600));
  // Same number as the Figma frame "Profile Tab – v2".
  return { trustScore: 0.78 };
}
