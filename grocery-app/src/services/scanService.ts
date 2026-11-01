import type { ScanPhoto } from '../store/useScanStore';
import type {
  ApiScanResponse,
  GuessedStore,
  ScanProblem,
  ScanResult,
} from '../types/scan';
import { ApiError, apiRequest } from './api';
import { getAuthToken } from './auth';
import { USE_MOCK_DATA } from './priceService';

// Vision plus Shernice's parsing takes longer than a normal request.
const SCAN_TIMEOUT_MS = 30_000;

/** Sends the cropped photo to the backend and returns what OCR read from it. */
export async function scanPriceTag(
  photo: ScanPhoto,
  signal?: AbortSignal
): Promise<ScanResult> {
  if (USE_MOCK_DATA) return mockScan(signal);

  const form = new FormData();
  // React Native uploads a local file from this { uri, name, type } shape.
  form.append('image', {
    uri: photo.uri,
    name: 'price-tag.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const token = await getAuthToken();
  const response = await apiRequest<ApiScanResponse>('/api/v1/ocr/scan', {
    method: 'POST',
    body: form,
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
    if (error.status === 0) return 'network';
  }
  return 'server';
}

// TODO(location): use the phone's location and the stores table.
export async function guessStore(): Promise<GuessedStore | null> {
  return { name: 'Key Food', distanceMi: 0.4 };
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

// ---------------------------------------------------------------------------
// Mock mode: each scan returns the next outcome in this list, so every screen
// can be tested without the backend. Take 6 photos to see them all.
// ---------------------------------------------------------------------------

type MockOutcome = ApiScanResponse | { error: ApiError };

const MOCK_OUTCOMES: MockOutcome[] = [
  // 1. ok, everything read -> Confirm Details, all yellow
  {
    status: 'ok',
    reason: null,
    itemName: 'Chicken Breast, Boneless',
    brand: 'Perdue',
    unitSize: '1.5 lb',
    price: 5.29,
    priceConfidence: 0.96,
  },
  // 2. ok, but no name or size (common, per Shernice) -> Confirm Details,
  //    item name and size highlighted
  {
    status: 'ok',
    reason: null,
    itemName: null,
    brand: 'Barilla',
    unitSize: null,
    price: 1.99,
    priceConfidence: 0.91,
  },
  // 3. low_confidence / low_score -> "Couldn't read the price"
  {
    status: 'low_confidence',
    reason: 'low_score',
    itemName: 'Greek Yogurt, Plain',
    brand: 'Chobani',
    unitSize: '32 oz',
    price: null,
    priceConfidence: 0.41,
  },
  // 4. low_confidence / read_failed -> "Couldn't read that tag"
  {
    status: 'low_confidence',
    reason: 'read_failed',
    itemName: null,
    brand: null,
    unitSize: null,
    price: null,
    priceConfidence: null,
  },
  // 5. No connection -> "Couldn't reach the server"
  { error: new ApiError('mock: no connection', 0) },
  // 6. Daily limit -> "You've used today's scans"
  { error: new ApiError('mock: Daily OCR scan limit reached', 429) },
];

let mockScanCount = 0;

async function mockScan(signal?: AbortSignal): Promise<ScanResult> {
  // Long enough to see the "Reading price tag…" screen.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  if (signal?.aborted) throw new ApiError('mock: cancelled', 0);

  const outcome = MOCK_OUTCOMES[mockScanCount % MOCK_OUTCOMES.length];
  mockScanCount += 1;

  if ('error' in outcome) throw outcome.error;
  return toScanResult(outcome);
}
