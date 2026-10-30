// Mean Earth radius in statute miles. Distances are straight-line estimates.
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

/**
 * Calculate a Store's distance in miles locally, without retaining coordinates.
 * Missing Store coordinates return null; invalid coordinates throw RangeError.
 * User coordinates are validated even when Store coordinates are missing.
 */
export function calculateStoreDistanceMiles(
  userLatitude: number,
  userLongitude: number,
  storeLatitude: number | null | undefined,
  storeLongitude: number | null | undefined
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
  // Clamp rounding errors at antipodal points before taking square roots.
  const clamped = Math.max(0, Math.min(1, haversine));
  return (
    2 *
    EARTH_RADIUS_MILES *
    Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped))
  );
}
