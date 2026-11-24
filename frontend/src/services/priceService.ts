import type { PriceDrop } from '../types/price';
export { searchItems, getItemById } from './realPriceService';
// No price-drop endpoint exists yet. Render the honest empty state.
export async function getPriceDrops(): Promise<PriceDrop[]> { return []; }
