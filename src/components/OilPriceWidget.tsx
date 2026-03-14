import { useEffect, useState } from 'react';
import { useStore } from '../store';
import type { OilPrice } from '../types';

export default function OilPriceWidget() {
  const storePrice = useStore((s) => s.oilPrice);
  const [localPrice, setLocalPrice] = useState<OilPrice | null>(null);

  useEffect(() => {
    async function fetchPrice() {
      try {
        // Try Yahoo Finance via a CORS proxy
        const res = await fetch(
          'https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?interval=1d&range=5d'
        );
        if (!res.ok) return;
        const data = await res.json();
        const result = data.chart?.result?.[0];
        if (!result) return;

        const meta = result.meta;
        const closes = result.indicators?.quote?.[0]?.close || [];
        const currentPrice = meta.regularMarketPrice;
        const previousClose = closes.length >= 2 ? closes[closes.length - 2] : currentPrice;
        const change = currentPrice - previousClose;
        const changePercent = previousClose ? (change / previousClose) * 100 : 0;

        setLocalPrice({
          symbol: 'BZ=F',
          name: 'Brent Crude',
          price: Math.round(currentPrice * 100) / 100,
          change: Math.round(change * 100) / 100,
          changePercent: Math.round(changePercent * 100) / 100,
          timestamp: Date.now(),
        });
      } catch {
        // Yahoo blocks CORS from browsers — will fall back to store data
      }
    }

    fetchPrice();
    const interval = setInterval(fetchPrice, 15 * 60_000);
    return () => clearInterval(interval);
  }, []);

  const oilPrice = localPrice || storePrice;
  if (!oilPrice) return null;

  const isUp = oilPrice.change >= 0;

  return (
    <div className="absolute top-16 right-4 z-10 bg-slate-900/80 backdrop-blur-md rounded-lg border border-slate-700/50 p-2.5 shadow-xl">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
        Brent Crude
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold text-white font-mono">
          ${oilPrice.price.toFixed(2)}
        </span>
        <span className={`text-xs font-medium ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {isUp ? '+' : ''}{oilPrice.change.toFixed(2)} ({isUp ? '+' : ''}{oilPrice.changePercent.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}
