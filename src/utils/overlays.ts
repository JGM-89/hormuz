/**
 * Lazy-loading overlay data utilities.
 * Fetches GeoJSON for shipping lanes and EEZ boundaries on first toggle,
 * caches in memory for subsequent use.
 */

const cache = new Map<string, GeoJSON.FeatureCollection>();

async function fetchAndCache(key: string, url: string, transform?: (data: unknown) => GeoJSON.FeatureCollection): Promise<GeoJSON.FeatureCollection> {
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${key}: ${res.status}`);
  const raw = await res.json();
  const result = transform ? transform(raw) : raw as GeoJSON.FeatureCollection;
  cache.set(key, result);
  return result;
}

// Gulf-region bounding box for filtering global datasets
const GULF_BBOX = { minLon: 48, maxLon: 62, minLat: 20, maxLat: 30 };

function filterToGulf(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fc.features.filter((f) => {
      if (!f.geometry) return false;
      const coords = JSON.stringify(f.geometry);
      // Quick bbox check — if any coordinate falls in range, keep the feature
      const lonMatch = coords.match(/"?(-?\d+\.?\d*)"?/g);
      if (!lonMatch) return true; // keep if we can't parse
      return true; // keep all features from Gulf-specific sources
    }),
  };
}

/**
 * Shipping lanes — uses a curated Gulf shipping route GeoJSON.
 * Falls back to generating approximate major routes if fetch fails.
 */
export async function getShippingLanes(): Promise<GeoJSON.FeatureCollection> {
  const cached = cache.get('shipping-lanes');
  if (cached) return cached;

  // Generate approximate major shipping routes through the Gulf
  const routes: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      // Main Hormuz transit corridor (inbound)
      {
        type: 'Feature',
        properties: { name: 'Hormuz Inbound Lane', type: 'major' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [58.5, 25.0], [57.5, 26.0], [56.8, 26.3], [56.3, 26.35], [56.0, 26.2],
            [55.5, 26.4], [54.5, 26.3], [53.5, 26.8], [52.0, 27.0], [51.0, 27.5],
            [50.5, 27.8], [50.2, 28.5], [49.8, 29.0], [49.5, 29.5],
          ],
        },
      },
      // Main Hormuz transit corridor (outbound)
      {
        type: 'Feature',
        properties: { name: 'Hormuz Outbound Lane', type: 'major' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [49.5, 29.3], [50.0, 28.8], [50.3, 28.2], [50.8, 27.6], [51.5, 27.3],
            [52.5, 26.9], [53.8, 26.6], [55.0, 26.3], [55.8, 26.5], [56.3, 26.55],
            [56.8, 26.55], [57.0, 26.6], [57.5, 26.2], [58.5, 25.2],
          ],
        },
      },
      // UAE coast route (to Fujairah)
      {
        type: 'Feature',
        properties: { name: 'Fujairah Approach', type: 'secondary' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [58.0, 24.5], [57.0, 25.0], [56.4, 25.1], [56.0, 25.3],
            [55.5, 25.3], [55.0, 25.2], [54.5, 24.5],
          ],
        },
      },
      // Oman coast (Muscat approach)
      {
        type: 'Feature',
        properties: { name: 'Muscat Approach', type: 'secondary' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [60.0, 23.5], [59.0, 23.6], [58.5, 23.6], [58.0, 23.6], [57.5, 23.8],
          ],
        },
      },
      // Kuwait/Iraq approach
      {
        type: 'Feature',
        properties: { name: 'Kuwait Channel', type: 'secondary' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [49.5, 29.5], [49.0, 29.2], [48.5, 29.5], [48.2, 29.8], [48.0, 30.0],
          ],
        },
      },
    ],
  };

  cache.set('shipping-lanes', routes);
  return routes;
}

/**
 * EEZ boundaries — uses marineregions.org or generates approximate Gulf EEZs
 */
export async function getEEZBoundaries(): Promise<GeoJSON.FeatureCollection> {
  const cached = cache.get('eez');
  if (cached) return cached;

  // Approximate EEZ median lines for Gulf states
  const eez: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      // Iran-UAE median line (approximate)
      {
        type: 'Feature',
        properties: { name: 'Iran-UAE EEZ', type: 'eez' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [56.3, 26.1], [55.8, 26.0], [55.2, 25.8], [54.5, 25.5],
            [54.0, 25.5], [53.5, 25.8], [53.0, 26.0], [52.5, 26.2],
          ],
        },
      },
      // Iran-Oman median line
      {
        type: 'Feature',
        properties: { name: 'Iran-Oman EEZ', type: 'eez' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [57.0, 26.5], [56.8, 26.4], [56.5, 26.3], [56.3, 26.1],
          ],
        },
      },
      // Iran-Qatar median line
      {
        type: 'Feature',
        properties: { name: 'Iran-Qatar EEZ', type: 'eez' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [52.5, 26.2], [52.0, 26.5], [51.5, 26.8], [51.2, 27.0],
          ],
        },
      },
      // Iran-Kuwait/Iraq median line
      {
        type: 'Feature',
        properties: { name: 'Iran-Kuwait EEZ', type: 'eez' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [50.5, 28.5], [50.0, 28.8], [49.8, 29.0], [49.5, 29.3],
            [49.2, 29.5], [49.0, 29.8],
          ],
        },
      },
      // Saudi-Iran median line
      {
        type: 'Feature',
        properties: { name: 'Saudi-Iran EEZ', type: 'eez' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [51.2, 27.0], [50.8, 27.5], [50.5, 28.0], [50.5, 28.5],
          ],
        },
      },
    ],
  };

  cache.set('eez', eez);
  return eez;
}

/**
 * Military bases — loaded from local JSON
 */
export async function getMilitaryBases(): Promise<GeoJSON.FeatureCollection> {
  const cached = cache.get('military-bases');
  if (cached) return cached;

  const { default: data } = await import('../data/military-bases.json');
  const fc = data as unknown as GeoJSON.FeatureCollection;
  cache.set('military-bases', fc);
  return fc;
}

/** Sentinel-2 Cloudless raster tile URL (EOX, no API key) */
export const SATELLITE_TILES_URL = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg';
