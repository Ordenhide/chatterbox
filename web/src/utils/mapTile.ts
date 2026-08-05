/**
 * Standard OSM "slippy map" tile math — converts a lat/lng to the tile that
 * contains it at a given zoom level. Used to fetch a single free, no-API-key
 * static map preview tile rather than pulling in a full map SDK.
 */
export function latLngToTile(lat: number, lng: number, zoom: number): {x: number; y: number; z: number} {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return {x: clamp(x, 0, n - 1), y: clamp(y, 0, n - 1), z: zoom};
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** A single OpenStreetMap raster tile URL covering the given position. Free, no API key. */
export function staticMapTileUrl(lat: number, lng: number, zoom = 15): string {
  const {x, y, z} = latLngToTile(lat, lng, zoom);
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

export function formatCoordinates(lat: number, lng: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lng).toFixed(4)}°${ew}`;
}
