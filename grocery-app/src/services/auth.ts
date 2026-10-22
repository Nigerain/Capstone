// TEMPORARY until the Login screen exists: a token saved in .env by `npm run dev-token`.
// Tokens expire after about an hour. Never commit a real token.
export async function getAuthToken(): Promise<string | null> {
    return process.env.EXPO_PUBLIC_DEV_ID_TOKEN ?? null;
  }