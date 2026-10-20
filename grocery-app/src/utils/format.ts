import type { Item, Price } from '../types/price';
import { getUnitPrice } from './price';

export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// 3.5266 + "lb" → "$3.53/lb"
export function formatUnitPrice(amount: number, unit: string): string {
  return `${formatPrice(amount)}/${unit}`;
}

// 0.4 → "0.4 mi"
export function formatDistance(miles: number): string {
  return `${miles.toFixed(1)} mi`;
}

// 1.5 + "lb" → "1.5 lb"; returns null when the size is unknown
export function formatSize(size: number | null, unit: string | null): string | null {
  return size != null && unit ? `${size} ${unit}` : null;
}

// "Perdue · 1.5 lb", or just "Perdue" when the size is unknown
export function formatBrandSize(item: Item): string {
  const size = formatSize(item.size, item.sizeUnit);
  return size ? `${item.brand} · ${size}` : item.brand;
}

// "Key Food · 0.4 mi", or just "Key Food" when the distance is unknown
export function formatStoreLine(price: Price): string {
  return price.distanceMi != null
    ? `${price.store} · ${formatDistance(price.distanceMi)}`
    : price.store;
}

// "$3.53/lb" for this item at this price, or null when the size is unknown
export function formatItemUnitPrice(item: Item, price: Price): string | null {
  const unitPrice = getUnitPrice(item, price);
  return unitPrice != null && item.sizeUnit ? formatUnitPrice(unitPrice, item.sizeUnit) : null;
}