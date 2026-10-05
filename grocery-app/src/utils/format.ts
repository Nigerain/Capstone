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

// 1.5 + "lb" → "1.5 lb"
export function formatSize(size: number, unit: string): string {
  return `${size} ${unit}`;
}