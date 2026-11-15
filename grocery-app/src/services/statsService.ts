// The signed-in user's reputation and activity, for the Profile tab's
// reputation card.
export type MyStats = {
  levelName: string; // "Trusted Contributor"
  points: number; // 150
  nextLevelName: string | null; // "Top Contributor", or null at the top level
  pointsToNextLevel: number; // 60
  progress: number; // 0 to 1: how far from this level to the next
  accuracy: number; // 0 to 1: share of their prices others confirmed
  pricesSubmitted: number;
  votesCast: number;
};

// TODO(backend): there's no endpoint for this yet, so it's mock data in
// every mode. The tables already have what's needed (PriceSubmission and
// PriceVote rows per user), and Dixon's calculate_reputation() in
// backend/app/service/submitter_reputation.py gives a 0-1 score that fits
// `accuracy`. Points and levels still need deciding with Dixon. Once Ceren
// adds something like GET /api/v1/users/me/stats, call it here with
// apiGet(..., await getAuthToken()) and map the response to MyStats.
export async function getMyStats(): Promise<MyStats> {
  // Pretend to talk to a server so the loading state is visible.
  await new Promise((resolve) => setTimeout(resolve, 600));
  // Same numbers as the Figma frame "Profile Tab".
  return {
    levelName: 'Trusted Contributor',
    points: 150,
    nextLevelName: 'Top Contributor',
    pointsToNextLevel: 60,
    progress: 0.55,
    accuracy: 0.94,
    pricesSubmitted: 18,
    votesCast: 42,
  };
}
