/** Haversine distance in metres between two lat/lng pairs. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Estimated arrival in minutes given distance (m) and speed (m/s).
 *  Falls back to a brisk-walk/slow-bus baseline if speed is unknown. */
export function etaMinutes(distM: number, speedMs?: number | null): number {
  const v = !speedMs || speedMs < 1 ? 8 : speedMs; // ~29 km/h fallback
  return Math.max(0, Math.round(distM / v / 60));
}