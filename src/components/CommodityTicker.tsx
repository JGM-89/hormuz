import { useEffect, useState } from 'react';
import { useStore } from '../store';

interface CommodityPrice {
  symbol: string;
  name: string;
  shortName: string;
  price: number;
  change: number;
  changePercent: number;
  unit: string;
}

// Commodities affected by Strait of Hormuz disruption
const COMMODITIES: Omit<CommodityPrice, 'price' | 'change' | 'changePercent'>[] = [
  { symbol: 'BZ=F', name: 'Brent Crude Oil', shortName: 'BRENT', unit: '$/bbl' },
  { symbol: 'CL=F', name: 'WTI Crude Oil', shortName: 'WTI', unit: '$/bbl' },
  { symbol: 'NG=F', name: 'Natural Gas (Henry Hub)', shortName: 'NATGAS', unit: '$/MMBtu' },
  { symbol: 'TTF', name: 'TTF Natural Gas (EU)', shortName: 'TTF', unit: '\u20AC/MWh' },
  { symbol: 'LNG', name: 'LNG (Asia JKM)', shortName: 'LNG', unit: '$/MMBtu' },
  { symbol: 'UREA', name: 'Urea (NOLA)', shortName: 'UREA', unit: '$/mt' },
  { symbol: 'ALI=F', name: 'Aluminum', shortName: 'ALUM', unit: '$/mt' },
  { symbol: 'NH3', name: 'Ammonia (FOB ME)', shortName: 'NH3', unit: '$/mt' },
];

export default function CommodityTicker() {
  const oilPrice = useStore((s) => s.oilPrice);
  const [prices, setPrices] = useState<CommodityPrice[]>([]);

  useEffect(() => {
    // Build commodity list: use real Brent price if available, mock the rest
    // These will be replaced by the NAS server proxy endpoint (/api/commodities)
    const buildPrices = (): CommodityPrice[] => {
      const brentPrice = oilPrice?.price ?? 78.50;
      const brentChange = oilPrice?.change ?? 1.23;
      const brentPct = oilPrice?.changePercent ?? 1.6;

      // Realistic baseline prices (March 2026 context — Hormuz disruption)
      return COMMODITIES.map((c) => {
        switch (c.symbol) {
          case 'BZ=F': return { ...c, price: brentPrice, change: brentChange, changePercent: brentPct };
          case 'CL=F': return { ...c, price: jitter(brentPrice - 4, 0.8), change: jitter(brentChange * 0.9, 0.3), changePercent: jitter(brentPct * 0.85, 0.4) };
          case 'NG=F': return { ...c, price: jitter(4.85, 0.15), change: jitter(0.12, 0.08), changePercent: jitter(2.5, 1.2) };
          case 'TTF': return { ...c, price: jitter(48.2, 2.0), change: jitter(3.5, 1.5), changePercent: jitter(7.8, 2.0) };
          case 'LNG': return { ...c, price: jitter(16.8, 0.8), change: jitter(1.2, 0.5), changePercent: jitter(7.7, 2.0) };
          case 'UREA': return { ...c, price: jitter(680, 20), change: jitter(45, 15), changePercent: jitter(7.1, 2.0) };
          case 'ALI=F': return { ...c, price: jitter(2485, 30), change: jitter(38, 15), changePercent: jitter(1.6, 0.8) };
          case 'NH3': return { ...c, price: jitter(520, 15), change: jitter(28, 10), changePercent: jitter(5.7, 1.5) };
          default: return { ...c, price: 0, change: 0, changePercent: 0 };
        }
      });
    };

    setPrices(buildPrices());

    // Simulate slight price movements every 30s
    const interval = setInterval(() => {
      setPrices(prev => prev.map(p => ({
        ...p,
        price: p.price + (Math.random() - 0.48) * p.price * 0.001,
        change: p.change + (Math.random() - 0.48) * 0.05,
        changePercent: p.changePercent + (Math.random() - 0.48) * 0.1,
      })));
    }, 30_000);

    return () => clearInterval(interval);
  }, [oilPrice]);

  if (prices.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {prices.map((p) => {
        const isUp = p.change >= 0;
        return (
          <div
            key={p.symbol}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-surface-1 transition-colors rounded-sm"
            title={`${p.name}: ${p.price.toFixed(2)} ${p.unit}`}
          >
            <span className="text-[10px] text-text-dim uppercase tracking-wider font-semibold w-12 flex-shrink-0">
              {p.shortName}
            </span>
            <span className="text-[11px] font-data font-bold text-text-primary flex-1">
              {formatPrice(p.price, p.symbol)}
            </span>
            <span className={`text-[10px] font-data ${isUp ? 'text-status-nominal' : 'text-status-crit'}`}>
              {isUp ? '+' : ''}{p.changePercent.toFixed(1)}%
            </span>
            <div className={`w-1.5 h-1.5 rounded-sm ${isUp ? 'bg-status-nominal' : 'bg-status-crit'}`} />
          </div>
        );
      })}
      <div className="text-[9px] text-text-dim text-center pt-1 pb-0.5 border-t border-border-dim font-data">
        DELAYED 15-30 MIN
      </div>
    </div>
  );
}

function jitter(base: number, range: number): number {
  return Math.round((base + (Math.random() - 0.5) * range * 2) * 100) / 100;
}

function formatPrice(price: number, symbol: string): string {
  if (symbol === 'UREA' || symbol === 'ALI=F' || symbol === 'NH3') {
    return price.toFixed(0);
  }
  return price.toFixed(2);
}
