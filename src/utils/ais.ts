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
  80: 'Tanker',
  81: 'Tanker (Hazmat A)',
  82: 'Tanker (Hazmat B)',
  83: 'Tanker (Hazmat C)',
  84: 'Tanker (Hazmat D)',
  85: 'Tanker',
  86: 'Tanker',
  87: 'Tanker',
  88: 'Tanker',
  89: 'Tanker (No cargo info)',
};

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

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
