// Strait of Hormuz Traffic Separation Scheme (approximate)
// The strait is about 21nm wide at its narrowest point

export const HORMUZ_CENTER: [number, number] = [55.8, 25.8]; // Wider view: UAE coast + strait
export const HORMUZ_ZOOM = 7;

// Approximate TSS lanes (GeoJSON LineStrings)
export const TSS_INBOUND: [number, number][] = [
  [56.0, 26.2],
  [56.25, 26.35],
  [56.5, 26.5],
  [56.75, 26.55],
  [57.0, 26.45],
];

export const TSS_OUTBOUND: [number, number][] = [
  [57.0, 26.6],
  [56.75, 26.7],
  [56.5, 26.65],
  [56.25, 26.5],
  [56.0, 26.35],
];

// Narrow passage polygon (chokepoint area)
export const CHOKEPOINT_POLYGON: [number, number][] = [
  [56.0, 26.1],
  [56.6, 26.25],
  [57.1, 26.3],
  [57.1, 26.75],
  [56.6, 26.8],
  [56.0, 26.55],
  [56.0, 26.1],
];

// Key geographic markers
export const LANDMARKS: { name: string; coords: [number, number] }[] = [
  { name: 'Musandam Peninsula', coords: [56.25, 26.38] },
  { name: 'Qeshm Island', coords: [56.27, 26.85] },
  { name: 'Larak Island', coords: [56.35, 26.87] },
  { name: 'Hormuz Island', coords: [56.46, 27.06] },
  { name: 'Greater Tunb', coords: [55.3, 26.26] },
  { name: 'Lesser Tunb', coords: [55.14, 26.24] },
  { name: 'Abu Musa', coords: [55.02, 25.87] },
];

// Haversine distance in nautical miles
export function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth radius in nm
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Compute speeds (in knots) between consecutive trail points
export function computeTrailSpeeds(trail: { lat: number; lon: number; ts: number }[]): number[] {
  const speeds: number[] = [];
  for (let i = 1; i < trail.length; i++) {
    const dist = haversineNm(trail[i - 1].lat, trail[i - 1].lon, trail[i].lat, trail[i].lon);
    const hours = (trail[i].ts - trail[i - 1].ts) / 3600000;
    speeds.push(hours > 0 ? Math.min(dist / hours, 30) : 0); // cap at 30kn
  }
  return speeds;
}

// Transit progress: 0-100% through the strait (based on longitude)
const STRAIT_LON_START = 56.0;
const STRAIT_LON_END = 57.1;
export function getTransitProgress(lon: number, course: number): number {
  const raw = (lon - STRAIT_LON_START) / (STRAIT_LON_END - STRAIT_LON_START);
  const clamped = Math.max(0, Math.min(1, raw));
  // Westbound: invert
  return (course >= 180 ? 1 - clamped : clamped) * 100;
}

export function getCongestionLevel(vesselCount: number): {
  level: 'low' | 'moderate' | 'high' | 'critical';
  color: string;
  label: string;
} {
  if (vesselCount <= 10) return { level: 'low', color: '#10b981', label: 'Low' };
  if (vesselCount <= 25) return { level: 'moderate', color: '#f59e0b', label: 'Moderate' };
  if (vesselCount <= 40) return { level: 'high', color: '#ef4444', label: 'High' };
  return { level: 'critical', color: '#dc2626', label: 'Critical' };
}
