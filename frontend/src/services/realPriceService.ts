import type { ApiItemSearchResponse, ApiPriceHistory } from '../types/api';
import type { Item } from '../types/price';
import { apiGet } from './api';
import { getAuthToken } from './auth';
import { toItem } from './mappers';

function fetchPriceHistory(itemId: string, token: string | null) {
  return apiGet<ApiPriceHistory>(`/api/v1/items/${encodeURIComponent(itemId)}/prices`, token);
}

export async function searchItems(query: string): Promise<Item[]> {
  const q = query.trim();
  if (!q) return [];

  const token = await getAuthToken();
  const { results } = await apiGet<ApiItemSearchResponse>(
    `/api/v1/items/search?q=${encodeURIComponent(q)}`,
    token,
  );

  // Get prices for each item found in search
  const histories = await Promise.all(
    results.map((item) => fetchPriceHistory(item.id, token)),
  );

  return results.map((item, i) => {
    return toItem(item, histories[i].prices);
  });
}

export async function getItemById(id: string): Promise<Item | null> {
  const token = await getAuthToken();
  const history = await fetchPriceHistory(id, token);

  // The price history response only includes the item's name and brand inside each price.
  // With no prices, there's nothing to build the item from.
  const first = history.prices[0];
  if (!first) return null;
  return toItem(first.item, history.prices);
}
