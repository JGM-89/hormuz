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
  return SHIP_TYPES[type] || 'Unknown';
}

const TANKER_NAME_RE = /tanker|crude|oil|petrol|lng|lpg|vlcc|ulcc|suezmax|aframax/i;

export function isTankerVessel(type: number, name: string): boolean {
  return (type >= 80 && type <= 89) || TANKER_NAME_RE.test(name);
}

export function getNavStatusLabel(status: number): string {
  return NAV_STATUS[status] ?? 'Unknown';
}

export function getSpeedColor(speed: number): string {
  if (speed <= 0.5) return '#64748b'; // slate — anchored
  if (speed <= 8) return '#22d3ee';   // cyan — slow
  if (speed <= 14) return '#10b981';  // green — normal
  return '#f59e0b';                    // amber — fast
}

export function formatSpeed(speed: number): string {
  return `${speed.toFixed(1)} kn`;
}

import type { RawVessel, Vessel } from '../types';

export function enrichVessel(raw: RawVessel): Vessel {
  return {
    ...raw,
    shipTypeLabel: getShipTypeLabel(raw.shipType),
    category: getShipCategory(raw.shipType),
    isTanker: isTankerVessel(raw.shipType, raw.name),
  };
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
