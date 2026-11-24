import { File } from 'expo-file-system';

import type { ScanPhoto } from '../store/useScanStore';
import type {
  ApiScanResponse,
  GuessedStore,
  ScanProblem,
  ScanResult,
} from '../types/scan';
import { ApiError, apiRequest } from './api';
import { getAuthToken } from './auth';

// Vision plus Shernice's parsing takes longer than a normal request.
const SCAN_TIMEOUT_MS = 45_000;

/** Sends the cropped photo to the backend and returns what OCR read from it. */
export async function scanPriceTag(
  photo: ScanPhoto,
  signal?: AbortSignal
): Promise<ScanResult> {
  // require a signed-in user before scanning, including sample scans.
  const token = await getAuthToken();
  if (!token) throw new ApiError('Sign in is required to scan a price tag.', 401);
  if (!process.env.EXPO_PUBLIC_API_URL) {
    throw new ApiError('The OCR backend address is missing.', 0);
  }

  // send JPEG bytes with the user token to avoid Expo multipart errors.
  const response = await apiRequest<ApiScanResponse>('/api/v1/ocr/scan-jpeg', {
    method: 'POST',
    body: await new File(photo.uri).arrayBuffer(),
    headers: { 'Content-Type': 'image/jpeg' },
    token,
    timeoutMs: SCAN_TIMEOUT_MS,
    signal,
  });
  return toScanResult(response);
}

/**
 * Cleans up the backend response so the screens get one consistent shape.
 * The backend's `status` decides everything; `priceConfidence` is ignored.
 */
export function toScanResult(api: ApiScanResponse): ScanResult {
  // Anything other than a clear "ok" is treated as low confidence, to be safe.
  const status = api.status === 'ok' ? 'ok' : 'low_confidence';
  return {
    status,
    reason: api.reason ?? null,
    itemName: clean(api.itemName),
    brand: clean(api.brand),
    unitSize: clean(api.unitSize),
    // Never prefill a price the backend wasn't sure about, even if one slips through.
    price: status === 'ok' ? parsePrice(api.price) : null,
  };
}

/** Decides which screen comes next: the review form, or which problem to show. */
export function problemForResult(result: ScanResult): ScanProblem | null {
  if (result.status === 'ok') return null;
  // "Couldn't read the price" says we got the item details, so it needs some.
  const readSomething = result.itemName || result.brand || result.unitSize;
  if (result.reason === 'read_failed' || !readSomething) return 'unreadable';
  return 'price';
}

/** Turns a failed request into the message the user should see. */
export function problemForError(error: unknown): ScanProblem {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'limit';
    if (error.status === 401 || error.status === 403) return 'auth';
    if (error.status === 0) return 'network';
  }
  return 'server';
}

// keep sample store suggestions out of real scans.
export async function guessStore(): Promise<GuessedStore | null> {
  return null;
}

function parsePrice(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  const number =
    typeof value === 'number' ? value : Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function clean(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
