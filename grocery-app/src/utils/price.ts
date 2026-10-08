import type { Item, Price } from '../types/price';

// $5.29 for a 1.5 lb pack → 3.53 per lb
export function getUnitPrice(item: Item, price: Price): number {
  return price.price / item.size;
}

export function getBestPrice(item: Item): Price | undefined {
  return item.prices.reduce<Price | undefined>(
    (best, p) => (!best || p.price < best.price ? p : best),
    undefined,
  );
}

export function getNearestPrice(item: Item): Price | undefined {
  return item.prices.reduce<Price | undefined>(
    (nearest, p) => (!nearest || p.distanceMi < nearest.distanceMi ? p : nearest),
    undefined,
  );
}