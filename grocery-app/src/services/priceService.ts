import type { Category, Item, Price, SizeUnit } from '../types/price';

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
];

export async function searchItems(query: string): Promise<Item[]> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));

  // "chicken breast" → ["chicken", "breast"]; every word must appear in brand + name.
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  return MOCK_ITEMS.filter((item) => {
    const text = `${item.brand} ${item.name}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}