export const NAV_STATUS: Record<number, string> = {
  0: 'Under way using engine',
  1: 'At anchor',
  2: 'Not under command',
  3: 'Restricted manoeuvrability',
  4: 'Constrained by draught',
  5: 'Moored',
  6: 'Aground',
  7: 'Engaged in fishing',
  8: 'Under way sailing',
  9: 'Reserved (HSC)',
  10: 'Reserved (WIG)',
  11: 'Power-driven vessel towing astern',
  12: 'Power-driven vessel pushing ahead',
  14: 'AIS-SART',
  15: 'Not defined',
};

export const SHIP_TYPES: Record<number, string> = {
  // 20-29: Wing in Ground
  20: 'WIG', 21: 'WIG (Hazmat A)', 22: 'WIG (Hazmat B)', 23: 'WIG (Hazmat C)', 24: 'WIG (Hazmat D)',
  // 30-39: Fishing, Towing, etc.
  30: 'Fishing', 31: 'Towing', 32: 'Towing (large)', 33: 'Dredger', 34: 'Diving ops',
  35: 'Military ops', 36: 'Sailing', 37: 'Pleasure craft',
  // 40-49: High-speed craft
  40: 'HSC', 41: 'HSC (Hazmat A)', 42: 'HSC (Hazmat B)', 43: 'HSC (Hazmat C)', 44: 'HSC (Hazmat D)',
  49: 'HSC (No info)',
  // 50-59: Special
  50: 'Pilot', 51: 'SAR', 52: 'Tug', 53: 'Port tender', 54: 'Anti-pollution',
  55: 'Law enforcement', 58: 'Medical', 59: 'Special craft',
  // 60-69: Passenger
  60: 'Passenger', 61: 'Passenger (Hazmat A)', 62: 'Passenger (Hazmat B)',
  63: 'Passenger (Hazmat C)', 64: 'Passenger (Hazmat D)', 69: 'Passenger (No info)',
  // 70-79: Cargo
  70: 'Cargo', 71: 'Cargo (Hazmat A)', 72: 'Cargo (Hazmat B)',
  73: 'Cargo (Hazmat C)', 74: 'Cargo (Hazmat D)', 79: 'Cargo (No info)',
  // 80-89: Tanker
  80: 'Tanker', 81: 'Tanker (Hazmat A)', 82: 'Tanker (Hazmat B)',
  83: 'Tanker (Hazmat C)', 84: 'Tanker (Hazmat D)', 85: 'Tanker',
  86: 'Tanker', 87: 'Tanker', 88: 'Tanker', 89: 'Tanker (No info)',
};

export type ShipCategory = 'tanker' | 'cargo' | 'passenger' | 'hsc' | 'special' | 'other' | 'unknown';

export function getShipCategory(type: number): ShipCategory {
  if (type >= 80 && type <= 89) return 'tanker';
  if (type >= 70 && type <= 79) return 'cargo';
  if (type >= 60 && type <= 69) return 'passenger';
  if (type >= 40 && type <= 49) return 'hsc';
  if (type >= 50 && type <= 59) return 'special';
  if (type >= 30 && type <= 39) return 'other';
  return 'unknown';
}

export function getShipTypeLabel(type: number): string {
  return SHIP_TYPES[type] || (type === 0 ? 'Vessel' : 'Unknown');
}

const TANKER_NAME_RE = /tanker|crude|oil|petrol|lng|lpg|vlcc|ulcc|suezmax|aframax/i;

/** Infer AIS ship type from vessel name when shipType is 0/unknown */
const NAME_TYPE_PATTERNS: [RegExp, number][] = [
  [/tanker|crude|oil|petrol|lng|lpg|vlcc|ulcc|suezmax|aframax|chemical/i, 80], // Tanker
  [/bulk|cargo|container|general|carrier|feeder|box ship|freighter/i, 70],     // Cargo
  [/tug|svitzer|smit|boluda/i, 52],                                            // Tug
  [/pilot/i, 50],                                                              // Pilot
  [/patrol|navy|military|warship|frigate|destroyer|corvette/i, 35],            // Military
  [/fishing|trawl|seiner|longliner/i, 30],                                     // Fishing
  [/passenger|ferry|cruise|roro/i, 60],                                        // Passenger
  [/dredg/i, 33],                                                              // Dredger
  [/yacht|pleasure/i, 37],                                                     // Pleasure
  [/supply|offshore|anchor|platform|fpso|support/i, 59],                       // Special
  [/sar|rescue|salvage/i, 51],                                                 // SAR
];

function inferShipTypeFromName(name: string): number {
  if (!name) return 0;
  for (const [pattern, type] of NAME_TYPE_PATTERNS) {
    if (pattern.test(name)) return type;
  }
  return 0;
}

export function isTankerVessel(type: number, name: string): boolean {
  return (type >= 80 && type <= 89) || TANKER_NAME_RE.test(name);
}

export function getNavStatusLabel(status: number): string {
  return NAV_STATUS[status] ?? 'Unknown';
}

export function getSpeedColor(speed: number): string {
  if (speed <= 0.5) return '#64748b'; // slate — anchored/stationary
  if (speed <= 8) return '#22d3ee';   // cyan — slow (maneuvering, port approach)
  if (speed <= 18) return '#10b981';  // green — normal transit (12-18 kn typical)
  if (speed <= 25) return '#f59e0b';  // amber — fast
  return '#ef4444';                    // red — anomalous
}

export function formatSpeed(speed: number): string {
  return `${speed.toFixed(1)} kn`;
}

import type { RawVessel, Vessel } from '../types';

/** Cap AIS speed at 30 knots — fastest Gulf traffic is ~25kn (container ships).
 *  AISStream often sends corrupt ~48.5kn from faulty shore stations. */
const MAX_REALISTIC_SPEED = 30;

/** Check if coordinates are valid and within the Gulf region */
export function isValidPosition(lat: number, lon: number): boolean {
  if (!isFinite(lat) || !isFinite(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  // AIS "not available" markers
  if (Math.abs(lat) > 89.9) return false;
  // Gulf region with generous margin
  if (lat < 22 || lat > 30 || lon < 48 || lon > 62) return false;
  return true;
}

export function enrichVessel(raw: RawVessel): Vessel {
  const speed = raw.speed > MAX_REALISTIC_SPEED ? 0 : raw.speed;
  const shipType = raw.shipType || inferShipTypeFromName(raw.name);
  return {
    ...raw,
    speed,
    shipType,
    shipTypeLabel: getShipTypeLabel(shipType),
    category: getShipCategory(shipType),
    isTanker: isTankerVessel(shipType, raw.name),
  };
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
