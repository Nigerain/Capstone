const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const TIMEOUT_MS = 10_000; // give up after 10 seconds

// An error that remembers the HTTP status code (404, 401, 500...).
// Status 0 means no response at all: timeout, wrong address, backend not running, or no Wi-Fi.
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  token?: string | null; // Firebase ID token, for endpoints that need sign-in
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, token } = options;

  if (!BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set. Add it to your .env file.');
  }

  // AbortController lets us cancel the request if it takes too long.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers, // custom headers last, so they can override the defaults
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      // FastAPI explains errors in the body, e.g. {"detail": "Not authenticated"}
      const detail = await response.text();
      throw new ApiError(
        `${method} ${path} failed (${response.status}): ${detail || response.statusText}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(`${method} ${path} timed out after ${TIMEOUT_MS / 1000}s`, 0);
    }
    // fetch itself failed: wrong address, backend not running, or no network
    throw new ApiError(`${method} ${path} could not reach the server: ${String(error)}`, 0);
  } finally {
    clearTimeout(timer); // always stop the timer, success or failure
  }
}

// True when the server answered "that doesn't exist" (404).
export const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;

// True when we never got an answer: no Wi-Fi, timeout, or backend down.
export const isNetworkError = (error: unknown) => error instanceof ApiError && error.status === 0;

// React Query retry rule: retry network blips and 5xx up to 2 times,
// but fail fast on 4xx (not found, not signed in) since retrying won't change the answer.
export function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

// Shortcuts so endpoint code stays short.
export const apiGet = <T>(path: string, token?: string | null) =>
  apiRequest<T>(path, { token });

export const apiPost = <T>(path: string, body: unknown, token?: string | null) =>
  apiRequest<T>(path, { method: 'POST', body, token });