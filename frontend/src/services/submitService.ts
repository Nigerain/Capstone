import type { ApiCreateItem, ApiItemSearchResponse } from '../types/api';
import { ApiError, apiRequest, apiGet } from './api';
import { getAuthToken } from './auth';

export type SubmitPriceInput = {
  itemName: string; brand: string; unitSize: string;
  storeId: string; price: number; isPublic: boolean;
};
// Price details used by the success screen
export type SavedPrice = {
  itemId: string;
  price: number;
  isPublic: boolean;
};
const UNITS: Record<string, NonNullable<ApiCreateItem['unit']>> = {
  lb: 'LB', lbs: 'LB', pound: 'LB', pounds: 'LB', oz: 'OZ', ounces: 'OZ',
  g: 'G', kg: 'KG', ml: 'ML', l: 'L', 'fl oz': 'FL_OZ', fl_oz: 'FL_OZ',
  pt: 'PT', qt: 'QT', gal: 'GAL', gallon: 'GAL', each: 'EACH', ea: 'EACH',
  dozen: 'DOZEN', dz: 'DOZEN', serving: 'SERVING', pack: 'PACK', pk: 'PACK',
  ct: 'PACK', count: 'PACK', loaf: 'LOAF',
};
// Convert typed size into item unit fields
export function parseSize(value: string): Pick<ApiCreateItem, 'unitAmount' | 'unit'> {
  if (!value.trim()) return { unitAmount: null, unit: null };
  const match = value.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z_ ]+)$/);
  const unit = match && UNITS[match[2].trim()];
  if (!match || !unit || Number(match[1]) <= 0) {
    throw new Error('Enter a size such as 1.5 lb, 64 fl oz or 12 ct, or leave it blank.');
  }
  return { unitAmount: Number(match[1]), unit };
}
// Prepare price submission using item and store IDs
export function toRequestBody(input: SubmitPriceInput, itemId: string) {
  return {
    itemId,
    storeId: input.storeId, price: Math.round(input.price * 100) / 100, isPublic: input.isPublic,
  };
}
// Find item or create it before submitting price
export async function submitPrice(input: SubmitPriceInput): Promise<SavedPrice> {
  const token = await getAuthToken();
  if (!token) throw new ApiError('Sign in to submit a price.', 401);
  const size = parseSize(input.unitSize);
  const itemName = input.itemName.trim();
  const brand = input.brand.trim() || null;
  const { results } = await apiGet<ApiItemSearchResponse>(
    `/api/v1/items/search?q=${encodeURIComponent(itemName)}`, token,
  );
  // Match name, brand and size so different products stay separate
  const text = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
  const matches = results.filter((item) => text(item.itemName) === text(itemName)
    && text(item.brand) === text(brand)
    && (item.unitAmount ?? null) === size.unitAmount
    && (item.unit ?? null) === size.unit);
  let itemId = matches.sort((a, b) => a.id.localeCompare(b.id))[0]?.id;
  if (!itemId) {
    // Create new item and use its ID
    const item = await apiRequest<{ id: string }>('/api/v1/items', {
      method: 'POST', token,
      body: { itemName, brand, ...size },
    });
    if (!item.id) throw new Error('The server did not return a new item ID.');
    itemId = item.id;
  }
  // Save price using the existing backend endpoint
  await apiRequest<{ message: string }>('/api/v1/prices', {
    method: 'POST', body: toRequestBody(input, itemId), token,
  });
  return { itemId, price: Math.round(input.price * 100) / 100, isPublic: input.isPublic };
}
export const isAuthError = (error: unknown) =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);
export function submitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (isAuthError(error)) return 'Log in again, then submit.';
    if (error.status === 0)
      return 'Could not confirm the save. Check your connection before submitting again.';
    if (error.status === 409) return 'This price may already be saved, or your profile or item selection needs attention.';
    if (error.status === 400 || error.status === 422) return 'Check the item, store, size and price, then try again.';
    return 'The database is unavailable. Your form is still here; please try again later.';
  }
  return error instanceof Error ? error.message : 'Unable to save the price.';
}
