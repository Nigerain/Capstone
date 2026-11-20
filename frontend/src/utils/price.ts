import type { Item, Price } from '../types/price';

// $5.29 for a 1.5 lb pack → 3.53 per lb.
// Returns null when the size is unknown, since there's nothing to divide by.
export function getUnitPrice(item: Item, price: Price): number | null {
  return item.size ? price.price / item.size : null;
}

// The cheapest store for this item, or undefined if nobody has submitted a price yet.
export function getBestPrice(item: Item): Price | undefined {
  return item.prices.reduce<Price | undefined>(
    (best, p) => (!best || p.price < best.price ? p : best),
    undefined,
  );
}

// For sorting by distance: unknown distances go last.
export function distanceForSorting(price: Price): number {
  return price.distanceMi ?? Number.MAX_SAFE_INTEGER;
}

// The closest store that has a price for this item.
export function getNearestPrice(item: Item): Price | undefined {
  return item.prices.reduce<Price | undefined>(
    (nearest, p) =>
      !nearest || distanceForSorting(p) < distanceForSorting(nearest) ? p : nearest,
    undefined,
  );
}