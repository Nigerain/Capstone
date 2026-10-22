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

  // Search results don't include prices, so load each item's price history.
  // TEMPORARY: one extra request per result, until search includes the lowest price.
  // allSettled runs them all at once, and one failure doesn't break the whole search.
  const histories = await Promise.allSettled(
    results.map((item) => fetchPriceHistory(item.id, token)),
  );

  return results.map((item, i) => {
    const history = histories[i];
    return toItem(item, history.status === 'fulfilled' ? history.value.prices : []);
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