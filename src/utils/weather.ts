// Beaufort scale lookup
const BEAUFORT_TABLE: { maxKnots: number; label: string }[] = [
  { maxKnots: 1, label: 'Calm' },
  { maxKnots: 3, label: 'Light air' },
  { maxKnots: 6, label: 'Light breeze' },
  { maxKnots: 10, label: 'Gentle breeze' },
  { maxKnots: 16, label: 'Moderate breeze' },
  { maxKnots: 21, label: 'Fresh breeze' },
  { maxKnots: 27, label: 'Strong breeze' },
  { maxKnots: 33, label: 'Near gale' },
  { maxKnots: 40, label: 'Gale' },
  { maxKnots: 47, label: 'Strong gale' },
  { maxKnots: 55, label: 'Storm' },
  { maxKnots: 63, label: 'Violent storm' },
  { maxKnots: Infinity, label: 'Hurricane force' },
];

export function toBeaufort(knots: number): { scale: number; label: string } {
  for (let i = 0; i < BEAUFORT_TABLE.length; i++) {
    if (knots <= BEAUFORT_TABLE[i].maxKnots) {
      return { scale: i, label: BEAUFORT_TABLE[i].label };
    }
  }
  return { scale: 12, label: 'Hurricane force' };
}

export function computePassageRisk(
  windKnots: number,
  gustsKnots: number,
  waveHeightM: number,
  visibilityKm: number,
): 'low' | 'moderate' | 'high' | 'severe' {
  // Score each factor 0-3
  let score = 0;

  if (windKnots >= 40) score += 3;
  else if (windKnots >= 30) score += 2;
  else if (windKnots >= 20) score += 1;

  if (gustsKnots >= 50) score += 2;
  else if (gustsKnots >= 35) score += 1;

  if (waveHeightM >= 4) score += 3;
  else if (waveHeightM >= 2.5) score += 2;
  else if (waveHeightM >= 1.5) score += 1;

  if (visibilityKm < 1) score += 2;
  else if (visibilityKm < 5) score += 1;

  if (score >= 7) return 'severe';
  if (score >= 4) return 'high';
  if (score >= 2) return 'moderate';
  return 'low';
}

const COMPASS_POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function windDirToCompass(degrees: number): string {
  const idx = Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16;
  return COMPASS_POINTS[idx];
}

export const RISK_CONFIG = {
  low: { color: '#00e676', label: 'LOW', ledClass: 'led-live' },
  moderate: { color: '#ffab00', label: 'MODERATE', ledClass: 'led-warn' },
  high: { color: '#ff6e40', label: 'HIGH', ledClass: 'led-warn' },
  severe: { color: '#ff1744', label: 'SEVERE', ledClass: 'led-crit' },
} as const;
