import type { CommodityData, CommodityPricePoint } from '../types';

export const MOCK_COMMODITIES: Omit<CommodityData, 'history'>[] = [
  { symbol: 'BZ=F', name: 'Brent Crude Oil', shortName: 'BRENT', unit: '$/bbl', price: 78.5, change: 1.23, changePercent: 1.6, high24h: 79.1, low24h: 76.8, open24h: 77.27, hormuzSensitivity: 0.95 },
  { symbol: 'CL=F', name: 'WTI Crude Oil', shortName: 'WTI', unit: '$/bbl', price: 74.5, change: 0.95, changePercent: 1.3, high24h: 75.2, low24h: 73.6, open24h: 73.55, hormuzSensitivity: 0.70 },
  { symbol: 'NG=F', name: 'Natural Gas (Henry Hub)', shortName: 'NATGAS', unit: '$/MMBtu', price: 4.85, change: 0.12, changePercent: 2.5, high24h: 4.95, low24h: 4.70, open24h: 4.73, hormuzSensitivity: 0.30 },
  { symbol: 'TTF=F', name: 'TTF Natural Gas (EU)', shortName: 'TTF', unit: '€/MWh', price: 48.2, change: 3.5, changePercent: 7.8, high24h: 49.5, low24h: 44.7, open24h: 44.7, hormuzSensitivity: 0.85 },
  { symbol: 'LNG', name: 'LNG (Asia JKM)', shortName: 'LNG', unit: '$/MMBtu', price: 16.8, change: 1.2, changePercent: 7.7, high24h: 17.2, low24h: 15.6, open24h: 15.6, hormuzSensitivity: 0.90 },
  { symbol: 'UREA', name: 'Urea (NOLA)', shortName: 'UREA', unit: '$/mt', price: 680, change: 45, changePercent: 7.1, high24h: 695, low24h: 635, open24h: 635, hormuzSensitivity: 0.60 },
  { symbol: 'ALI=F', name: 'Aluminum', shortName: 'ALUM', unit: '$/mt', price: 2485, change: 38, changePercent: 1.6, high24h: 2510, low24h: 2440, open24h: 2447, hormuzSensitivity: 0.15 },
  { symbol: 'NH3', name: 'Ammonia (FOB ME)', shortName: 'NH3', unit: '$/mt', price: 520, change: 28, changePercent: 5.7, high24h: 535, low24h: 492, open24h: 492, hormuzSensitivity: 0.75 },
];

export function generateMockHistory(base: number, volatility: number): CommodityPricePoint[] {
  const points: CommodityPricePoint[] = [];
  const now = Date.now();
  let price = base * (1 - volatility * 0.5);
  for (let i = 30; i >= 0; i--) {
    price += (Math.random() - 0.48) * base * volatility * 0.05;
    price = Math.max(price, base * 0.8);
    points.push({ timestamp: now - i * 86400000, price });
  }
  // Ensure last point matches current
  points[points.length - 1].price = base;
  return points;
}

export function getMockCommodities(): CommodityData[] {
  return MOCK_COMMODITIES.map((c) => ({
    ...c,
    history: generateMockHistory(c.price, Math.abs(c.changePercent) / 100 + 0.02),
  }));
}
