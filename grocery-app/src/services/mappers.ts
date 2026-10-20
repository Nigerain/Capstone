import type { ApiItem, ApiPriceEntry } from '../types/api';
import type { Item, Price } from '../types/price';

// The backend sends the same ID in two formats:
//   "f34daf33e3c94acdab57cd3d8a729de7" and "f34daf33-e3c9-4acd-ab57-cd3d8a729de7"
// Removing dashes and lowercasing makes them identical.
export function normalizeId(id: string): string {
  return id.replace(/-/g, '').toLowerCase();
}

// Different spellings people might type → one standard unit.
const UNIT_ALIASES: Record<string, string> = {
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  'fl oz': 'fl oz', floz: 'fl oz',
  gal: 'gal', gallon: 'gal', gallons: 'gal',
  ct: 'ct', count: 'ct', pk: 'ct', pack: 'ct',
  ea: 'each', each: 'each',
  g: 'g', kg: 'kg', ml: 'ml', l: 'l',
};

function normalizeUnit(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\.$/, ''); // "LB" → "lb", "oz." → "oz"
  return UNIT_ALIASES[key] ?? key; // unknown units are kept as typed
}

// Reads either size format the backend might send:
//   Dixon's:  { unitAmount: 1.5, unit: "LB" }  → { size: 1.5, sizeUnit: "lb" }
//   Ceren's:  { unitSize: "6 oz" }             → { size: 6,   sizeUnit: "oz" }
//   Missing:  { unitSize: null }               → { size: null, sizeUnit: null }
export function parseUnitSize(item: ApiItem): { size: number | null; sizeUnit: string | null } {
  if (item.unitAmount != null && item.unit) {
    return { size: item.unitAmount, sizeUnit: normalizeUnit(item.unit) };
  }

  if (item.unitSize) {
    // A number (decimals allowed), optional space, then the unit: "6 oz", "1.5lb", "12 ct"
    const match = item.unitSize.trim().match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
    if (match) {
      return { size: Number(match[1]), sizeUnit: normalizeUnit(match[2]) };
    }
  }

  return { size: null, sizeUnit: null };
}

// One backend price entry → one app Price
export function toPrice(entry: ApiPriceEntry): Price {
  return {
    id: normalizeId(entry.id),
    itemName: entry.item.itemName,
    price: entry.price,
    unit: parseUnitSize(entry.item).sizeUnit ?? undefined,
    store: entry.store.storeName,
    storeId: normalizeId(entry.store.id),
    // distanceMi: left out until stores have coordinates
    submittedAt: entry.dateRecorded,
  };
}

// A backend item (plus its price entries, if we have them) → one app Item
export function toItem(apiItem: ApiItem, entries: ApiPriceEntry[] = []): Item {
  const { size, sizeUnit } = parseUnitSize(apiItem);
  return {
    id: normalizeId(apiItem.id),
    name: apiItem.itemName,
    brand: apiItem.brand,
    size,
    sizeUnit,
    prices: entries.map(toPrice),
  };
}