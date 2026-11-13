import type { Store } from '../types/price';

// Stores for the Store Picker.
//
// MOCK ONLY for now: the backend has no "list stores" endpoint yet
// (backend/app/api/stores.py is empty). When it exists:
//   1. add ApiStore → Store in mappers.ts (storeName → name, normalizeId(id))
//   2. add getNearbyStores to realPriceService.ts
//   3. switch on USE_MOCK_DATA here, like searchItems in priceService.ts
// Distances should then come from Dixon's haversine helper (layout branch,
// calculateStoreDistanceMiles) using the phone's location.

const MOCK_DELAY = 400;

// Same stores and distances as the mock prices in mockPriceService.ts.
const MOCK_STORES: Store[] = [
  {
    id: 'store-key-food',
    name: 'Key Food',
    distanceMi: 0.4,
    closesAt: '10 PM',
  },
  {
    id: 'store-shoprite',
    name: 'ShopRite',
    distanceMi: 1.1,
    closesAt: '11 PM',
  },
  {
    id: 'store-food-bazaar',
    name: 'Food Bazaar',
    distanceMi: 1.3,
    closesAt: '10 PM',
  },
  {
    id: 'store-whole-foods',
    name: 'Whole Foods',
    distanceMi: 2.0,
    closesAt: '10 PM',
  },
  {
    id: 'store-trader-joes',
    name: "Trader Joe's",
    distanceMi: 2.4,
    closesAt: '9 PM',
  },
  { id: 'store-c-town', name: 'C-Town', distanceMi: 2.9, closesAt: '9 PM' },
  {
    id: 'store-fairway',
    name: 'Fairway Market',
    distanceMi: 3.6,
    closesAt: '10 PM',
  },
];

// Closest first; stores with no distance go last.
function byDistance(a: Store, b: Store): number {
  return (a.distanceMi ?? Infinity) - (b.distanceMi ?? Infinity);
}

/** Nearby stores, closest first. A query keeps only names that contain it. */
export async function getNearbyStores(query = ''): Promise<Store[]> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));

  // Ignore case and apostrophes, so "trader joes" finds "Trader Joe's".
  const simplify = (text: string) =>
    text.toLowerCase().replace(/['’]/g, '').trim();
  const q = simplify(query);

  return MOCK_STORES.filter((store) => simplify(store.name).includes(q)).sort(
    byDistance
  );
}

/** The store the user is most likely standing in: the closest one. */
// TODO(location): use the phone's location once expo-location is added.
export async function guessStore(): Promise<Store | null> {
  const [closest] = await getNearbyStores();
  return closest ?? null;
}
