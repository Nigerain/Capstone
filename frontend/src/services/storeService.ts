import type { ApiStore } from '../types/api';
import type { Store } from '../types/price';
import { ApiError, apiGet } from './api';
import { getAuthToken } from './auth';

// Get stores from database
export async function getNearbyStores(query = ''): Promise<Store[]> {
  const token = await getAuthToken();
  if (!token) throw new ApiError('Sign in to load stores.', 401);
  // Search saved stores by name
  const stores = await apiGet<ApiStore[]>(`/api/v1/stores/search?q=${encodeURIComponent(query.trim() || '%')}`, token);
  return stores.map((store) => ({
    id: store.id, name: store.storeName, address: store.storeLocation,
    latitude: store.latitude, longitude: store.longitude,
  }));
}
