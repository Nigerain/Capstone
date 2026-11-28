import type { ApiSubmitPrice } from '../types/api';
import type {
  Category,
  Item,
  Price,
  PriceDrop,
  SizeUnit,
} from '../types/price';
import { distanceForSorting } from '../utils/price';
import { findMockStore } from './storeService';

const MOCK_DELAY = 500;

const SUBMITTERS = [
  { name: 'Dixon', reputation: 85 },
  { name: 'Ceren', reputation: 60 },
  { name: 'Shernice', reputation: 72 },
  { name: 'Ada', reputation: 90 },
];

// [store, distance in miles, package price]
type PriceSeed = [store: string, distanceMi: number, price: number];

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function makeItem(
  id: string,
  name: string,
  brand: string,
  size: number,
  sizeUnit: SizeUnit,
  category: Category,
  seeds: PriceSeed[],
): Item {
  const prices: Price[] = seeds.map(([store, distanceMi, price], i) => {
    const submitter = SUBMITTERS[i % SUBMITTERS.length];
    return {
      id: `${id}-p${i + 1}`,
      itemName: name,
      price,
      unit: sizeUnit,
      store,
      distanceMi,
      submittedBy: submitter.name,
      submitterReputation: submitter.reputation,
      submittedAt: daysAgo(i),
      confirmCount: Math.max(0, 5 - i),
      disputeCount: i === 3 ? 1 : 0,
    };
  });

  return { id, name, brand, size, sizeUnit, category, prices };
}

const MOCK_ITEMS: Item[] = [
  makeItem('1', 'Chicken Breast, Boneless', 'Perdue', 1.5, 'lb', 'Meat', [
    ['Key Food', 0.4, 5.29],
    ['ShopRite', 1.1, 5.79],
    ['Food Bazaar', 1.3, 5.99],
    ['Whole Foods', 2.0, 6.49],
    ["Trader Joe's", 2.4, 6.89],
  ]),
  makeItem('2', 'Chicken Breast, Boneless', 'Tyson', 2.5, 'lb', 'Meat', [
    ['ShopRite', 1.1, 8.99],
    ['Key Food', 0.4, 9.49],
  ]),
  makeItem('3', 'Chicken Breast, Boneless', '365', 1, 'lb', 'Meat', [
    ['Whole Foods', 2.0, 4.49],
  ]),
  makeItem('4', 'Chicken Breast Tenderloins', 'Perdue', 1, 'lb', 'Meat', [
    ['Food Bazaar', 1.3, 5.49],
    ['Key Food', 0.4, 5.79],
  ]),
  makeItem('5', 'Organic Chicken Breast', 'Bell & Evans', 1, 'lb', 'Meat', [
    ["Trader Joe's", 2.4, 7.99],
    ['Whole Foods', 2.0, 8.49],
  ]),
  makeItem('6', 'Chicken Thighs, Bone-In', 'Perdue', 2, 'lb', 'Meat', [
    ['Key Food', 0.4, 4.99],
    ['ShopRite', 1.1, 5.29],
  ]),
  makeItem('7', 'Whole Milk', 'Farmland', 1, 'gal', 'Dairy', [
    ['Key Food', 0.4, 5.29],
    ['ShopRite', 1.1, 5.49],
    ['Food Bazaar', 1.3, 4.99],
  ]),
  makeItem('8', 'Large Eggs', "Eggland's Best", 12, 'ct', 'Dairy', [
    ['ShopRite', 1.1, 4.99],
    ['Key Food', 0.4, 5.49],
  ]),
  makeItem('9', 'Basmati Rice', 'Royal', 5, 'lb', 'Pantry', [
    ['ShopRite', 1.1, 6.49],
    ['Food Bazaar', 1.3, 6.99],
  ]),
  makeItem('10', 'Broccoli Florets', 'Birds Eye', 12, 'oz', 'Frozen', [
    ['Key Food', 0.4, 2.49],
    ["Trader Joe's", 2.4, 1.99],
  ]),

  // --- Extra items so each category screen has a few full shelves ---
  // Dairy
  makeItem('11', '2% Reduced Fat Milk', 'Key Food', 1, 'gal', 'Dairy', [['Key Food', 0.4, 3.99], ['ShopRite', 1.1, 4.29]]),
  makeItem('12', 'Lactose-Free Milk', 'Lactaid', 64, 'fl oz', 'Dairy', [['ShopRite', 1.1, 4.79]]),
  makeItem('13', 'Large Brown Eggs', "Pete & Gerry's", 12, 'ct', 'Dairy', [['Whole Foods', 2.0, 5.49], ['Key Food', 0.4, 5.99]]),
  makeItem('14', 'Cage-Free Large Eggs', 'Vital Farms', 12, 'ct', 'Dairy', [["Trader Joe's", 2.4, 6.99]]),
  makeItem('15', 'Sharp Cheddar', 'Cabot', 8, 'oz', 'Dairy', [['Key Food', 0.4, 3.99], ['Food Bazaar', 1.3, 4.29]]),
  makeItem('16', 'Shredded Mozzarella', 'Polly-O', 16, 'oz', 'Dairy', [['ShopRite', 1.1, 5.49]]),
  makeItem('17', 'American Cheese Slices', 'Kraft', 16, 'ct', 'Dairy', [['Food Bazaar', 1.3, 4.29]]),
  makeItem('18', 'Greek Plain Nonfat Yogurt', 'Fage', 32, 'oz', 'Dairy', [['Whole Foods', 2.0, 6.99], ['ShopRite', 1.1, 7.29]]),
  makeItem('19', 'Vanilla Greek Yogurt', 'Chobani', 5.3, 'oz', 'Dairy', [['Key Food', 0.4, 1.29]]),
  makeItem('20', 'Original Oat Milk', 'Oatly', 64, 'fl oz', 'Dairy', [["Trader Joe's", 2.4, 5.49], ['Whole Foods', 2.0, 5.79]]),
  makeItem('21', 'Unsweetened Almond Milk', 'Almond Breeze', 64, 'fl oz', 'Dairy', [['ShopRite', 1.1, 3.79]]),
  // Meat
  makeItem('22', 'Ground Beef 80/20', 'Key Food', 1, 'lb', 'Meat', [['Key Food', 0.4, 5.49], ['Food Bazaar', 1.3, 5.79]]),
  makeItem('23', 'Ribeye Steak', 'USDA Choice', 1, 'lb', 'Meat', [['ShopRite', 1.1, 14.99]]),
  makeItem('24', 'Sirloin Steak', 'ShopRite', 1, 'lb', 'Meat', [['ShopRite', 1.1, 9.99]]),
  makeItem('25', 'Pork Tenderloin', 'Smithfield', 1.25, 'lb', 'Meat', [['Key Food', 0.4, 6.24]]),
  makeItem('26', 'Bone-In Pork Chops', 'Key Food', 1.5, 'lb', 'Meat', [['Key Food', 0.4, 5.99], ['C-Town', 2.9, 5.49]]),
  makeItem('27', 'Thick-Cut Bacon', 'Oscar Mayer', 16, 'oz', 'Meat', [['ShopRite', 1.1, 7.49]]),
  makeItem('28', 'Hickory Smoked Bacon', 'Smithfield', 12, 'oz', 'Meat', [['Food Bazaar', 1.3, 5.99]]),
  // Produce
  makeItem('29', 'Bananas', 'Dole', 2.5, 'lb', 'Produce', [['Key Food', 0.4, 1.48], ['ShopRite', 1.1, 1.59]]),
  makeItem('30', 'Honeycrisp Apples', 'Loose', 1, 'lb', 'Produce', [['Whole Foods', 2.0, 2.49]]),
  makeItem('31', 'Red Seedless Grapes', 'Loose', 2, 'lb', 'Produce', [['Food Bazaar', 1.3, 5.98]]),
  makeItem('32', 'Strawberries', "Driscoll's", 1, 'lb', 'Produce', [['ShopRite', 1.1, 3.99], ['Key Food', 0.4, 4.29]]),
  makeItem('33', 'Blueberries', "Driscoll's", 6, 'oz', 'Produce', [["Trader Joe's", 2.4, 2.99]]),
  makeItem('34', 'Baby Spinach', 'Organic Girl', 5, 'oz', 'Produce', [['Whole Foods', 2.0, 3.99]]),
  makeItem('35', 'Romaine Hearts', 'Fresh Express', 3, 'ct', 'Produce', [['Key Food', 0.4, 3.49]]),
  makeItem('36', 'Roma Tomatoes', 'Loose', 1, 'lb', 'Produce', [['Food Bazaar', 1.3, 1.49]]),
  makeItem('37', 'Red Bell Pepper', 'Loose', 1, 'each', 'Produce', [['Key Food', 0.4, 1.49]]),
  // Pantry
  makeItem('38', 'Jasmine Rice', 'Mahatma', 5, 'lb', 'Pantry', [['ShopRite', 1.1, 6.49]]),
  makeItem('39', 'Long Grain White Rice', 'Goya', 3, 'lb', 'Pantry', [['Food Bazaar', 1.3, 3.49], ['Key Food', 0.4, 3.79]]),
  makeItem('40', 'Spaghetti', 'Barilla', 16, 'oz', 'Pantry', [['Key Food', 0.4, 1.79]]),
  makeItem('41', 'Marinara Sauce', "Rao's", 24, 'oz', 'Pantry', [['Whole Foods', 2.0, 8.99], ['ShopRite', 1.1, 9.49]]),
  makeItem('42', 'Black Beans', 'Goya', 15.5, 'oz', 'Pantry', [['Food Bazaar', 1.3, 1.29]]),
  makeItem('43', 'Chickpeas', 'Goya', 15.5, 'oz', 'Pantry', [['Key Food', 0.4, 1.29]]),
  // Frozen
  makeItem('44', 'Mixed Vegetables', 'Key Food', 16, 'oz', 'Frozen', [['Key Food', 0.4, 1.49]]),
  makeItem('45', 'Sweet Peas', 'Green Giant', 12, 'oz', 'Frozen', [['ShopRite', 1.1, 2.29]]),
  makeItem('46', 'Rising Crust Pepperoni Pizza', 'DiGiorno', 27.5, 'oz', 'Frozen', [['ShopRite', 1.1, 7.99], ['Key Food', 0.4, 8.49]]),
  makeItem('47', 'Thin Crust Cheese Pizza', "Newman's Own", 14, 'oz', 'Frozen', [['Whole Foods', 2.0, 6.49]]),
  makeItem('48', 'Vanilla Bean Ice Cream', 'Häagen-Dazs', 14, 'oz', 'Frozen', [['Key Food', 0.4, 5.49]]),
  makeItem('49', 'Cookies & Cream Ice Cream', 'Breyers', 48, 'oz', 'Frozen', [['Food Bazaar', 1.3, 5.99]]),
];

// "chicken breast" → ["chicken", "breast"]; every word must appear in brand + name.
function findMatches(query: string): Item[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  return MOCK_ITEMS.filter((item) => {
    const text = `${item.brand} ${item.name}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

export async function searchItems(query: string): Promise<Item[]> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  return findMatches(query);
}

// Every item in one category, for the category screen to sort onto shelves.
// TODO: replace with the backend once it has GET /api/v1/items?category=…
export async function getCategoryItems(category: Category): Promise<Item[]> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  // Only items someone has priced; a shelf card needs a price to show.
  return MOCK_ITEMS.filter(
    (item) => item.category === category && item.prices.length > 0
  );
}

/**
 * Mock stand-in for what the backend does with a submitted price:
 * adds it to the matching item (which keeps its own category), or creates
 * a new item in the chosen category. Returns the item's id.
 * Lives only in memory, so it resets when the app reloads.
 */
export function recordMockSubmission(
  body: ApiSubmitPrice,
  unitText: string, // "lb" for unit 'LB'; '' when no size was given
): string {
  const store = findMockStore(body.storeId);
  const [match] = findMatches(body.item.itemName);
  const itemId = match?.id ?? `mock-item-${Date.now()}`;
  const size = body.item.unitAmount;
  const sizeUnit = size != null && unitText ? unitText : null;

  const price: Price = {
    id: `${itemId}-p${Date.now()}`,
    itemName: body.item.itemName,
    price: body.price,
    unit: sizeUnit ?? undefined,
    store: store?.name ?? 'Unknown store',
    storeId: body.storeId,
    distanceMi: store?.distanceMi,
    submittedBy: 'You',
    submittedAt: new Date().toISOString(),
    confirmCount: 0,
    disputeCount: 0,
  };

  if (match) {
    match.prices.unshift(price);
  } else {
    MOCK_ITEMS.push({
      id: itemId,
      name: body.item.itemName,
      brand: body.item.brand ?? '',
      size,
      sizeUnit,
      category: body.item.category,
      prices: [price],
    });
  }
  return itemId;
}

export async function getItemById(id: string): Promise<Item | null> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  return MOCK_ITEMS.find((item) => item.id === id) ?? null;
}

// Mock price history: [item id, store, what it cost before].
// TODO: replace with the backend's price-drops endpoint once it exists.
type PreviousPriceSeed = [itemId: string, store: string, previousPrice: number];

const MOCK_PREVIOUS_PRICES: PreviousPriceSeed[] = [
  ['7', 'Key Food', 6.01], // Whole Milk  $6.01 → $5.29
  ['9', 'ShopRite', 7.05], // Basmati Rice $7.05 → $6.49
  ['1', 'Key Food', 5.89], // Chicken Breast $5.89 → $5.29
  ['8', 'ShopRite', 5.39], // Large Eggs $5.39 → $4.99
];

// Biggest drop first; if two drops tie, the closer store wins.
export async function getPriceDrops(): Promise<PriceDrop[]> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));

  return MOCK_PREVIOUS_PRICES.flatMap(([itemId, store, previousPrice]) => {
    const item = MOCK_ITEMS.find((i) => i.id === itemId);
    const price = item?.prices.find((p) => p.store === store);
    if (!item || !price || price.price >= previousPrice) return [];

    const dropPercent = Math.round(
      ((previousPrice - price.price) / previousPrice) * 100
    );
    return [{ item, price, previousPrice, dropPercent }];
  }).sort(
    (a, b) =>
      b.dropPercent - a.dropPercent || distanceForSorting(a.price) - distanceForSorting(b.price)
  );
}