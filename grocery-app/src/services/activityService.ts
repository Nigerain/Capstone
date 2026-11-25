import { ApiError, apiGet } from './api';
import { getAuthToken } from './auth';

// The Activity tab: prices the signed-in user posted and how people voted.
// Has its own switch, like scanning, submitting and voting, because
// vote-history doesn't return the item, store or price yet (Dixon is adding
// itemId, itemName, storeName and price to GetSubmitterVoteHistory).
// Mock unless .env explicitly says false.
// Changing it needs a restart with a cleared cache: npx expo start -c
export const USE_MOCK_ACTIVITY =
  process.env.EXPO_PUBLIC_USE_MOCK_ACTIVITY !== 'false';

// ---------------------------------------------------------------------------
// Backend shapes
// ---------------------------------------------------------------------------

// Postgres COUNT() is a bigint, which can come through Data Connect as a
// string, so counts are typed loosely here and turned into numbers below.
type ApiCount = number | string | { count: number | string } | null;

// GET /api/v1/users/{uid}/stats
interface ApiUserStats {
  user: { id: string; createdAt: string };
  totalSubmissions: ApiCount;
}

// One row of GET /api/v1/users/{uid}/vote-history (GetSubmitterVoteHistory).
// itemId, itemName, storeName and price are the columns Dixon is adding.
interface ApiVoteHistoryRow {
  priceRecordId: string;
  submittedAt: string;
  itemId: string;
  itemName: string;
  storeName: string;
  price: number | string;
  upvotes: ApiCount;
  downvotes: ApiCount;
}

interface ApiVoteHistory {
  userId: string;
  priceHistory: ApiVoteHistoryRow[];
  count: number;
}

// ---------------------------------------------------------------------------
// What the screen uses
// ---------------------------------------------------------------------------

export type MyPrice = {
  id: string; // price record id
  itemId: string; // for opening Product Detail
  itemName: string;
  storeName: string;
  price: number;
  submittedAt: string; // ISO timestamp
  upvotes: number;
  downvotes: number;
};

export type MyActivity = {
  pricesAdded: number;
  confirmations: number; // upvotes across all their prices
  prices: MyPrice[]; // newest first
};

// The endpoint allows up to 100 rows; that covers anyone's history for demo.
const HISTORY_LIMIT = 100;

/** Loads the Activity tab for one user. Throws ApiError on any failure. */
export async function getMyActivity(uid: string): Promise<MyActivity> {
  if (USE_MOCK_ACTIVITY) return mockActivity();

  const token = await getAuthToken();
  if (!token)
    throw new ApiError('Sign in is required to see your activity.', 401);

  const id = encodeURIComponent(uid);
  const [stats, history] = await Promise.all([
    apiGet<ApiUserStats>(`/api/v1/users/${id}/stats`, token),
    apiGet<ApiVoteHistory>(
      `/api/v1/users/${id}/vote-history?limit=${HISTORY_LIMIT}`,
      token
    ),
  ]);
  return toMyActivity(stats.totalSubmissions, history.priceHistory);
}

function toMyActivity(
  totalSubmissions: ApiCount,
  rows: ApiVoteHistoryRow[]
): MyActivity {
  const prices = rows.map(toMyPrice);
  return {
    pricesAdded: toNumber(totalSubmissions),
    confirmations: prices.reduce((sum, p) => sum + p.upvotes, 0),
    prices,
  };
}

function toMyPrice(row: ApiVoteHistoryRow): MyPrice {
  return {
    id: row.priceRecordId,
    itemId: row.itemId,
    itemName: row.itemName,
    storeName: row.storeName,
    price: toNumber(row.price),
    submittedAt: row.submittedAt,
    upvotes: toNumber(row.upvotes),
    downvotes: toNumber(row.downvotes),
  };
}

// 12, "12" and { count: "12" } all become 12; anything unreadable becomes 0.
function toNumber(value: ApiCount): number {
  const raw = typeof value === 'object' && value !== null ? value.count : value;
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Status line and time label
// ---------------------------------------------------------------------------

export type PriceStatusKind = 'waiting' | 'confirmed' | 'incorrect';

/**
 * The line under each price. Plain vote counts for now; the team may switch
 * to Dixon's weighted confidence score later. The wording says what voters
 * did rather than judging the price, since a downvote can be wrong too.
 */
export function priceStatus(p: Pick<MyPrice, 'upvotes' | 'downvotes'>): {
  kind: PriceStatusKind;
  text: string;
} {
  if (p.upvotes + p.downvotes === 0) {
    return { kind: 'waiting', text: 'Waiting for votes' };
  }
  if (p.downvotes > p.upvotes) {
    const voters = p.downvotes === 1 ? '1 voter' : `${p.downvotes} voters`;
    return { kind: 'incorrect', text: `${voters} marked this as incorrect` };
  }
  const shoppers = p.upvotes === 1 ? '1 shopper' : `${p.upvotes} shoppers`;
  return { kind: 'confirmed', text: `${shoppers} confirmed` };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "This week" for the last 7 days, "Earlier" before that. */
export function isThisWeek(iso: string, now = Date.now()): boolean {
  return now - new Date(iso).getTime() < 7 * DAY_MS;
}

/** Splits prices into "This week" and "Earlier", leaving out empty groups. */
export function groupByWeek(
  prices: MyPrice[],
  now = Date.now()
): { title: string; data: MyPrice[] }[] {
  return [
    {
      title: 'This week',
      data: prices.filter((p) => isThisWeek(p.submittedAt, now)),
    },
    {
      title: 'Earlier',
      data: prices.filter((p) => !isThisWeek(p.submittedAt, now)),
    },
  ].filter((group) => group.data.length > 0);
}

/** "Just now", "5h", "2d", then "Oct 9" after a week. */
export function timeAgo(iso: string, now = Date.now()): string {
  const ms = Math.max(0, now - new Date(iso).getTime());
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(ms / DAY_MS);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Mock mode. Same rows as the Figma frame "Activity Tab – v2", in the
// backend's shape (counts as strings, like Data Connect may send them), so
// the mapping above runs in mock mode too. itemIds match mockPriceService,
// so tapping a row opens a real mock product.
// Set MOCK_EMPTY to true to see the "No prices posted yet" state.
// ---------------------------------------------------------------------------

const MOCK_EMPTY = false;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

async function mockActivity(): Promise<MyActivity> {
  // Long enough to see the loading skeleton.
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (MOCK_EMPTY) return toMyActivity('0', []);

  const rows: ApiVoteHistoryRow[] = [
    {
      priceRecordId: 'mock-a1',
      itemId: '1',
      itemName: 'Chicken Breast, Boneless',
      storeName: 'Key Food',
      price: 5.29,
      submittedAt: daysAgo(2),
      upvotes: '12',
      downvotes: '1',
    },
    {
      priceRecordId: 'mock-a2',
      itemId: '7',
      itemName: 'Whole Milk, 1 Gal',
      storeName: 'Key Food',
      price: 5.29,
      submittedAt: daysAgo(3),
      upvotes: '0',
      downvotes: '0',
    },
    {
      priceRecordId: 'mock-a3',
      itemId: '9',
      itemName: 'Basmati Rice, 5 lb',
      storeName: 'ShopRite',
      price: 6.99,
      submittedAt: daysAgo(4),
      upvotes: '1',
      downvotes: '3',
    },
    {
      priceRecordId: 'mock-a4',
      itemId: '8',
      itemName: 'Large Eggs, 12 ct',
      storeName: 'Food Bazaar',
      price: 3.99,
      submittedAt: daysAgo(47),
      upvotes: '8',
      downvotes: '0',
    },
  ];
  return toMyActivity({ count: '18' }, rows);
}
