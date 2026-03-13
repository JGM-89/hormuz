// Strait of Hormuz Traffic Separation Scheme (approximate)
// The strait is about 21nm wide at its narrowest point

export const HORMUZ_CENTER: [number, number] = [56.3, 26.5];
export const HORMUZ_ZOOM = 7.5;

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
