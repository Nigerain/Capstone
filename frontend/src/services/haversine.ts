import * as Location from 'expo-location';
import { Linking } from 'react-native';

// use the same project and connector as dataconnect.
const QUERY_URL = process.env.EXPO_PUBLIC_DATA_CONNECT_QUERY_URL ?? (
  'https://firebasedataconnect.googleapis.com/v1/' +
  'projects/grocerypricepal/locations/us-east4/' +
  'services/grocerypricepal-service/connectors/endpoint:executeQuery'
);

export interface StoreCoordinates {
  id: string;
  storeName: string;
  latitude: number | null;
  longitude: number | null;
}

export interface StoreDistance {
  store: StoreCoordinates;
  // distance in miles. leave it hidden when there is no location.
  distanceMiles: number | null;
}

// use the mean Earth radius in miles to estimate straight-line distances.
const EARTH_RADIUS_MILES = 3958.7613;
const TO_RADIANS = Math.PI / 180;

function validateCoordinates(latitude: number, longitude: number): void {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    throw new RangeError('Coordinates must be finite and within valid ranges.');
  }
}

// calculate the store's distance in miles locally without keeping coordinates.
// return null for missing store coordinates and throw RangeError for invalid ones.
// check the user's coordinates even when the store's coordinates are missing.
export function calculateStoreDistanceMiles(
  userLatitude: number,
  userLongitude: number,
  storeLatitude: number | null | undefined,
  storeLongitude: number | null | undefined,
): number | null {
  validateCoordinates(userLatitude, userLongitude);
  if (storeLatitude == null || storeLongitude == null) return null;
  validateCoordinates(storeLatitude, storeLongitude);

  const latitudeDifference = (storeLatitude - userLatitude) * TO_RADIANS;
  const longitudeDifference = (storeLongitude - userLongitude) * TO_RADIANS;
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(userLatitude * TO_RADIANS) *
      Math.cos(storeLatitude * TO_RADIANS) *
      Math.sin(longitudeDifference / 2) ** 2;
  // keep rounding errors between zero and one before taking square roots.
  const clamped = Math.max(0, Math.min(1, haversine));
  return (
    2 *
    EARTH_RADIUS_MILES *
    Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped))
  );
}

// grab the store's saved coordinates from the database.
// uses the signed-in user's Firebase ID token.
export async function fetchStoreCoordinates(
  storeId: string,
  firebaseIdToken: string,
): Promise<StoreCoordinates> {
  if (!storeId.trim()) {
    throw new Error('A store ID is required.');
  }
  if (!firebaseIdToken.trim()) {
    throw new Error('Sign in before loading store coordinates.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(QUERY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Firebase-Auth-Token': firebaseIdToken,
      },
      body: JSON.stringify({
        operationName: 'GetStoreCoordinates',
        variables: { storeId },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Could not load store coordinates (HTTP ${response.status}).`);
    }

    const result: {
      data?: { store?: StoreCoordinates | null };
      errors?: unknown[];
    } = await response.json();

    if (result.errors?.length) {
      throw new Error('The store-coordinate database query failed.');
    }
    if (!result.data || !('store' in result.data)) {
      throw new Error('The database did not return the store-coordinate query result.');
    }
    if (!result.data.store) {
      throw new Error('Store not found.');
    }

    const store = result.data.store;

    // check the saved coordinates before asking for the phone's location.
    calculateStoreDistanceMiles(0, 0, store.latitude, store.longitude);
    return store;
  } finally {
    clearTimeout(timeout);
  }
}

// call when the user chooses to turn on store distance.
// open phone settings if location permission cannot be requested again.
export async function enableStoreDistance(): Promise<boolean> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status === 'granted') {
    return true;
  }
  if (!permission.canAskAgain) {
    await Linking.openSettings();
    return false;
  }
  const result = await Location.requestForegroundPermissionsAsync();
  return result.status === 'granted';
}

// calculate how far the phone is from the store using its saved coordinates.
// check existing permission without prompting. users can turn on distance separately.
// keep the phone's coordinates out of database requests, storage, and the result.
// return a null distance if store coordinates or the phone's location are unavailable.
// let database and sign-in errors reach the caller.
export async function getDistanceToStore(
  storeId: string,
  firebaseIdToken: string,
): Promise<StoreDistance> {
  const store = await fetchStoreCoordinates(storeId, firebaseIdToken);
  if (store.latitude == null || store.longitude == null) {
    return { store, distanceMiles: null };
  }

  let phone: Location.LocationObject;

  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return { store, distanceMiles: null };
    }
    if (!await Location.hasServicesEnabledAsync()) {
      return { store, distanceMiles: null };
    }
    phone = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      mayShowUserSettingsDialog: false,
    });
  } catch {
    // keep browsing without a distance if location isn't available.
    return { store, distanceMiles: null };
  }

  return {
    store,
    distanceMiles: calculateStoreDistanceMiles(
      phone.coords.latitude,
      phone.coords.longitude,
      store.latitude,
      store.longitude,
    ),
  };
}
