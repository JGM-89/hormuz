import { useEffect, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useStore } from '../store';
import { getSeverity, getSeverityColor, formatCommodityPrice, computeRiskPremium, HORMUZ_SENSITIVITY } from '../utils/commodities';
import { MOCK_COMMODITIES, generateMockHistory } from '../utils/mockCommodities';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { CommodityData, CommodityPricePoint } from '../types';

const tooltipStyle = {
  backgroundColor: '#0c1e3a',
  border: '1px solid #1a3a5c',
  borderRadius: 2,
  fontSize: 10,
  fontFamily: '"JetBrains Mono", monospace',
  color: '#e0e8f0',
};

export default function CommodityPanel() {
  const storeCommodities = useStore((s) => s.commodities);
  const expandedCommodity = useStore((s) => s.expandedCommodity);
  const setExpandedCommodity = useStore((s) => s.setExpandedCommodity);
  const [commodities, setCommodities] = useState<CommodityData[]>([]);

  const isLive = storeCommodities.length > 0;

  // Use store data if available, otherwise use mock
  useEffect(() => {
    if (storeCommodities.length > 0) {
      setCommodities(storeCommodities);
    } else {
      // Generate mock data with history
      const mocks = MOCK_COMMODITIES.map((c) => ({
        ...c,
        history: generateMockHistory(c.price, Math.abs(c.changePercent) / 100 + 0.02),
      }));
      setCommodities(mocks);

      // Simulate small price movements every 30s
      const interval = setInterval(() => {
        setCommodities((prev) =>
          prev.map((p) => ({
            ...p,
            price: p.price + (Math.random() - 0.48) * p.price * 0.001,
            changePercent: p.changePercent + (Math.random() - 0.48) * 0.1,
          })),
        );
      }, 30_000);
      return () => clearInterval(interval);
    }
  }, [storeCommodities]);

  if (commodities.length === 0) return null;

  const riskPremium = computeRiskPremium(commodities);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-dim">
        <span className="label-caps">Commodities</span>
        <span className={`text-[10px] font-data uppercase tracking-wider ${isLive ? 'text-status-nominal' : 'text-status-warn'}`}>
          {isLive ? 'LIVE' : 'MOCK'}
        </span>
      </div>

      {/* Commodity rows */}
      <div className="divide-y divide-border-dim">
        {commodities.map((c) => (
          <CommodityRow
            key={c.symbol}
            commodity={c}
            expanded={expandedCommodity === c.symbol}
            onToggle={() => setExpandedCommodity(expandedCommodity === c.symbol ? null : c.symbol)}
          />
        ))}
      </div>

      {/* Hormuz Risk Premium */}
      <div className="px-3 py-2.5 border-t border-border-dim">
        <RiskPremiumCard premium={riskPremium} />
      </div>
    </div>
  );
}

function CommodityRow({
  commodity: c,
  expanded,
  onToggle,
}: {
  commodity: CommodityData;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isUp = c.change >= 0;
  const severity = getSeverity(c.changePercent);
  const sevColor = getSeverityColor(c.changePercent);
  const sparkColor = isUp ? '#00e676' : '#ff1744';

  return (
    <div>
      {/* Collapsed row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-3 py-2.5 hover:bg-surface-1 transition-colors cursor-pointer text-left"
        aria-expanded={expanded}
        aria-label={`${c.name}: ${formatCommodityPrice(c.price, c.symbol)} ${c.unit}, ${isUp ? 'up' : 'down'} ${Math.abs(c.changePercent).toFixed(1)}%`}
      >
        {/* Name */}
        <span className="text-[10px] text-text-dim uppercase tracking-wider font-semibold w-12 flex-shrink-0">
          {c.shortName}
        </span>

        {/* Mini sparkline */}
        <div className="w-16 h-6 flex-shrink-0">
          {c.history.length > 2 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={c.history.slice(-14)} margin={{ top: 1, right: 0, bottom: 0, left: 0 }}>
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={sparkColor}
                  fill={sparkColor}
                  fillOpacity={0.1}
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Price */}
        <span className="text-[11px] font-data font-bold text-text-primary flex-1 text-right">
          {formatCommodityPrice(c.price, c.symbol)}
        </span>

        {/* Change */}
        <span className={`text-[10px] font-data w-12 text-right`} style={{ color: sevColor }}>
          {isUp ? '+' : ''}{c.changePercent.toFixed(1)}%
        </span>

        {/* Trend icon */}
        {isUp ? (
          <TrendingUp size={12} className="flex-shrink-0" style={{ color: sevColor }} />
        ) : (
          <TrendingDown size={12} className="flex-shrink-0" style={{ color: sevColor }} />
        )}
      </button>

      {/* Expanded detail card */}
      {expanded && (
        <div className="px-3 pb-3 animate-fade-in">
          <div className="bg-surface-1 rounded-sm border border-border-dim p-2.5 space-y-2.5">
            {/* Full name */}
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-text-primary font-medium">{c.name}</span>
              <span className="text-[9px] text-text-dim font-data">{c.unit}</span>
            </div>

            {/* Larger sparkline with tooltip */}
            {c.history.length > 2 && (
              <div className="h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={c.history} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
                    <XAxis dataKey="timestamp" hide />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val: unknown) => [formatCommodityPrice(Number(val), c.symbol), 'Price']}
                      labelFormatter={(ts) => new Date(Number(ts)).toLocaleDateString()}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={sparkColor}
                      fill={sparkColor}
                      fillOpacity={0.15}
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* OHLC grid */}
            <div className="grid grid-cols-4 gap-1">
              <OHLCCell label="Open" value={formatCommodityPrice(c.open24h, c.symbol)} />
              <OHLCCell label="High" value={formatCommodityPrice(c.high24h, c.symbol)} color="#00e676" />
              <OHLCCell label="Low" value={formatCommodityPrice(c.low24h, c.symbol)} color="#ff1744" />
              <OHLCCell label="Current" value={formatCommodityPrice(c.price, c.symbol)} color={isUp ? '#00e676' : '#ff1744'} />
            </div>

            {/* 24h Range Bar */}
            <div>
              <div className="label-caps mb-1">Day Range</div>
              <RangeBar low={c.low24h} high={c.high24h} current={c.price} />
            </div>

            {/* Hormuz Sensitivity */}
            <div>
              <div className="label-caps mb-1">Hormuz Sensitivity</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-surface-2 rounded-sm overflow-hidden">
                  <div
                    className="h-full rounded-sm transition-all"
                    style={{
                      width: `${c.hormuzSensitivity * 100}%`,
                      backgroundColor: c.hormuzSensitivity > 0.7 ? '#ff1744' : c.hormuzSensitivity > 0.4 ? '#ffab00' : '#00e676',
                    }}
                  />
                </div>
                <span className="text-[10px] font-data text-text-dim">{Math.round(c.hormuzSensitivity * 100)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OHLCCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-[9px] text-text-dim uppercase tracking-wider">{label}</div>
      <div className="text-[11px] font-data font-bold" style={{ color: color || '#e0e8f0' }}>{value}</div>
    </div>
  );
}

function RangeBar({ low, high, current }: { low: number; high: number; current: number }) {
  const range = high - low;
  const position = range > 0 ? ((current - low) / range) * 100 : 50;

  return (
    <div className="relative">
      <div className="flex justify-between text-[9px] font-data text-text-dim mb-0.5">
        <span>{low.toFixed(low > 100 ? 0 : 2)}</span>
        <span>{high.toFixed(high > 100 ? 0 : 2)}</span>
      </div>
      <div className="h-1.5 bg-surface-2 rounded-sm relative">
        {/* Gradient fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{
            width: `${position}%`,
            background: 'linear-gradient(90deg, #ff1744, #ffab00, #00e676)',
            opacity: 0.6,
          }}
        />
        {/* Current position marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full border border-surface-0"
          style={{ left: `${position}%`, transform: `translateX(-50%) translateY(-50%)` }}
        />
      </div>
    </div>
  );
}

function RiskPremiumCard({ premium }: { premium: { dollarImpact: number; percentImpact: number } }) {
  const severity = getSeverity(premium.percentImpact);
  const sevColor = getSeverityColor(premium.percentImpact);
  const isUp = premium.dollarImpact >= 0;

  return (
    <div
      className="rounded-sm p-2 border"
      style={{ backgroundColor: `${sevColor}08`, borderColor: `${sevColor}30` }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className={`led ${severity === 'crit' ? 'led-crit' : severity === 'warn' ? 'led-warn' : 'led-live'}`}
        />
        <span className="label-caps" style={{ color: sevColor }}>Hormuz Risk Premium</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-data font-bold" style={{ color: sevColor }}>
          {isUp ? '+' : ''}${Math.abs(premium.dollarImpact).toFixed(2)}
        </span>
        <span className="text-[10px] font-data text-text-dim">
          / bbl ({isUp ? '+' : ''}{premium.percentImpact.toFixed(1)}%)
        </span>
      </div>
      <div className="text-[9px] text-text-dim mt-0.5">
        Weighted avg. commodity movement × strait sensitivity
      </div>
    </div>
  );
}
