import { Item } from '../types/price';

const MOCK_DELAY = 500;

const MOCK_ITEMS: Item[] = [
  {
    id: '1',
    name: 'Chicken Breast',
    prices: [
      {
        id: 'p1',
        itemName: 'Chicken Breast',
        price: 1.99,
        unit: 'lb',
        store: 'Lidl',
        submittedBy: 'Dixon',
        submitterReputation: 85,
        submittedAt: new Date().toISOString(),
        confirmCount: 4,
        disputeCount: 0,
      },
      {
        id: 'p2',
        itemName: 'Chicken Breast',
        price: 2.99,
        unit: 'lb',
        store: "Trader Joe's",
        submittedBy: 'Ceren',
        submitterReputation: 60,
        submittedAt: new Date().toISOString(),
        confirmCount: 2,
        disputeCount: 1,
      },
      {
        id: 'p3',
        itemName: 'Chicken Breast',
        price: 5.99,
        unit: 'lb',
        store: 'Costco',
        submittedBy: 'Shernice',
        submitterReputation: 40,
        submittedAt: new Date().toISOString(),
        confirmCount: 1,
        disputeCount: 0,
      },
    ],
  },
];

export async function searchItems(query: string): Promise<Item[]> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));

  if (!query.trim()) return [];

  return MOCK_ITEMS.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase())
  );
}