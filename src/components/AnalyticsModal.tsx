import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend,
} from 'recharts';
import { useStore } from '../store';
import { computeRiskPremium, formatCommodityPrice, getSeverity } from '../utils/commodities';
import { getMockCommodities } from '../utils/mockCommodities';
import { generateShippingForecast } from '../utils/shippingForecast';
import type { Vessel, CommodityData, WeatherCurrent, WeatherForecastDay } from '../types';

const COLORS = ['#00b4d8', '#ffab00', '#00e676', '#7c4dff', '#ff6e40', '#448aff'];
const tooltipStyle = {
  backgroundColor: '#0c1e3a',
  border: '1px solid #1a3a5c',
  borderRadius: 2,
  fontSize: 10,
  fontFamily: '"JetBrains Mono", monospace',
  color: '#e0e8f0',
};
const axisProps = { fontSize: 10, fill: '#4a5e78', fontFamily: '"JetBrains Mono", monospace' };

// ── Analysis generators ──

interface TrendData {
  vessels: { current: number; avg: number };
  speed: { current: number; avg: number };
  eastbound: { current: number; avg: number };
  westbound: { current: number; avg: number };
}

interface Anomaly {
  type: string;
  vessel: string;
  detail: string;
  severity: 'warn' | 'alert';
}

function pctDelta(current: number, avg: number): string {
  if (avg === 0) return 'N/A';
  const pct = ((current - avg) / avg) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${Math.round(pct)}%`;
}

function generateExecutiveSummary(
  vessels: Map<string, Vessel>,
  trends: TrendData | null,
  anomalies: Anomaly[],
  commodities: CommodityData[],
  weather: { current: WeatherCurrent | null },
): string {
  const parts: string[] = [];

  // Vessel count + trend
  const vesselCount = vessels.size;
  if (trends) {
    const delta = ((vesselCount - trends.vessels.avg) / Math.max(trends.vessels.avg, 1)) * 100;
    if (Math.abs(delta) > 5) {
      parts.push(`${vesselCount} vessels currently in the strait, ${delta > 0 ? 'up' : 'down'} ${Math.abs(Math.round(delta))}% from the 30-day average of ${trends.vessels.avg}.`);
    } else {
      parts.push(`${vesselCount} vessels currently transiting the strait, in line with the 30-day average.`);
    }
  } else {
    parts.push(`${vesselCount} vessels currently tracked in the strait.`);
  }

  // Directional traffic
  if (trends && trends.eastbound.avg > 0) {
    const eastDelta = ((trends.eastbound.current - trends.eastbound.avg) / trends.eastbound.avg) * 100;
    if (Math.abs(eastDelta) > 10) {
      parts.push(`Eastbound traffic is ${eastDelta > 0 ? 'elevated' : 'below average'} at ${trends.eastbound.current} transits/day vs the ${trends.eastbound.avg} average.`);
    }
  }

  // Commodity risk premium
  if (commodities.length > 0) {
    const rp = computeRiskPremium(commodities);
    const brent = commodities.find(c => c.symbol === 'BZ=F');
    if (brent) {
      const dir = brent.changePercent >= 0 ? 'up' : 'down';
      parts.push(`Brent crude is ${dir} ${Math.abs(brent.changePercent).toFixed(1)}% at $${brent.price.toFixed(2)}/bbl with an estimated Hormuz risk premium of ${rp.dollarImpact >= 0 ? '+' : ''}$${rp.dollarImpact.toFixed(2)}/bbl.`);
    }
  }

  // Weather summary
  if (weather.current) {
    const w = weather.current;
    const riskLabel = w.passageRisk === 'low' ? 'favorable' : w.passageRisk === 'moderate' ? 'moderate' : 'elevated';
    parts.push(`Sea conditions are ${riskLabel} with ${w.waveHeight}m waves and Beaufort ${w.beaufort}.`);
  }

  // Anomalies
  const alertCount = anomalies.filter(a => a.severity === 'alert').length;
  if (vesselCount === 0) {
    parts.push('AIS feed offline — anomaly detection unavailable.');
  } else if (alertCount > 0) {
    parts.push(`${alertCount} critical anomal${alertCount === 1 ? 'y' : 'ies'} detected.`);
  } else {
    parts.push('No AIS anomalies detected in current vessel data.');
  }

  return parts.join(' ');
}

function generateTrafficAnalysis(
  vessels: Map<string, Vessel>,
  trends: TrendData | null,
  speedProfile: { mean: number; stdDev: number; count: number } | null,
): string {
  const parts: string[] = [];
  const total = vessels.size;
  const moving = [...vessels.values()].filter(v => v.speed > 0.5);
  const anchored = total - moving.length;
  const eastbound = moving.filter(v => v.course >= 0 && v.course < 180).length;
  const westbound = moving.length - eastbound;

  // Traffic level assessment
  if (trends) {
    const delta = ((total - trends.vessels.avg) / Math.max(trends.vessels.avg, 1)) * 100;
    if (delta > 15) {
      parts.push(`Traffic is significantly above normal with ${total} vessels tracked, ${Math.round(delta)}% above the 30-day average. This could indicate convoy formation, seasonal demand increase, or vessels rerouting through the strait.`);
    } else if (delta < -15) {
      parts.push(`Traffic is significantly depressed with only ${total} vessels tracked, ${Math.abs(Math.round(delta))}% below the 30-day average. This may signal heightened geopolitical risk, weather avoidance, or reduced regional demand.`);
    } else {
      parts.push(`Traffic density is within normal parameters at ${total} vessels.`);
    }
  }

  // Direction balance
  if (moving.length > 0) {
    const ratio = eastbound / Math.max(westbound, 1);
    if (ratio > 1.5) {
      parts.push(`There is a notable eastbound imbalance (${eastbound} vs ${westbound} westbound), suggesting increased inbound cargo flow to Persian Gulf ports.`);
    } else if (ratio < 0.67) {
      parts.push(`Westbound traffic dominates (${westbound} vs ${eastbound} eastbound), indicating heavy export flow — consistent with elevated crude and LNG shipments.`);
    } else {
      parts.push(`Traffic is balanced between eastbound (${eastbound}) and westbound (${westbound}) movements.`);
    }
  }

  // Anchored vessels
  if (anchored > 0 && total > 0) {
    const anchoredPct = Math.round((anchored / total) * 100);
    if (anchoredPct > 30) {
      parts.push(`${anchored} vessels (${anchoredPct}%) are currently anchored — an unusually high proportion that may indicate port congestion or waiting for loading berths.`);
    }
  }

  // Speed assessment
  if (speedProfile) {
    if (speedProfile.mean < 8) {
      parts.push(`Average transit speed is ${speedProfile.mean} kn, below the typical 10-12 kn range, possibly due to traffic separation scheme congestion or slow-steaming.`);
    } else if (speedProfile.mean > 14) {
      parts.push(`Average transit speed is elevated at ${speedProfile.mean} kn, suggesting expedited transits.`);
    }
  }

  return parts.join(' ');
}

function generateAnomalyAnalysis(anomalies: Anomaly[], vesselCount: number): string {
  if (vesselCount === 0) return 'No AIS data available — anomaly detection requires a live vessel feed. Connect an AIS data source to enable real-time monitoring.';
  if (anomalies.length === 0) return 'No vessel-level anomalies detected in current AIS data. All tracked vessels are reporting positions within expected parameters. Note: this assessment is limited to AIS-observable behavior and does not reflect broader geopolitical or security conditions in the region.';

  const parts: string[] = [];
  const highSpeed = anomalies.filter(a => a.type === 'High Speed');
  const stale = anomalies.filter(a => a.type === 'Stale Position');
  const stopped = anomalies.filter(a => a.type === 'Stopped in Lane');

  if (highSpeed.length > 0) {
    parts.push(`${highSpeed.length} vessel${highSpeed.length > 1 ? 's' : ''} exceeding 16 knots: ${highSpeed.map(a => `${a.vessel} (${a.detail})`).join(', ')}. Speeds above 16 kn in the TSS are unusual and may indicate evasive maneuvering or incorrect AIS data.`);
  }
  if (stale.length > 0) {
    parts.push(`${stale.length} vessel${stale.length > 1 ? 's have' : ' has'} gone dark with no position update: ${stale.map(a => `${a.vessel} (${a.detail})`).join(', ')}. This could indicate AIS transponder issues, intentional signal suppression, or passage through a coverage gap.`);
  }
  if (stopped.length > 0) {
    parts.push(`${stopped.length} vessel${stopped.length > 1 ? 's' : ''} stationary in the traffic separation scheme. Stopped vessels in the TSS are a navigation hazard and may indicate mechanical failure or an incident.`);
  }

  return parts.join(' ');
}

function generateMarketAnalysis(
  commodities: CommodityData[],
  trends: TrendData | null,
): string {
  if (commodities.length === 0) return 'Commodity data unavailable.';

  const parts: string[] = [];
  const brent = commodities.find(c => c.symbol === 'BZ=F');
  const wti = commodities.find(c => c.symbol === 'CL=F');
  const ttf = commodities.find(c => c.symbol === 'TTF=F');
  const lng = commodities.find(c => c.symbol === 'LNG');

  // Biggest movers
  const sorted = [...commodities].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  const biggestMover = sorted[0];

  // Energy complex direction
  const energyCommodities = commodities.filter(c => ['BZ=F', 'CL=F', 'NG=F', 'TTF=F', 'LNG'].includes(c.symbol));
  const positiveCount = energyCommodities.filter(c => c.changePercent > 0).length;
  const negativeCount = energyCommodities.filter(c => c.changePercent < 0).length;
  const isAligned = positiveCount >= 4 || negativeCount >= 4;

  if (brent) {
    const dir = brent.changePercent >= 0 ? 'rose' : 'fell';
    parts.push(`Brent crude ${dir} ${Math.abs(brent.changePercent).toFixed(1)}% to $${brent.price.toFixed(2)}/bbl.`);
  }

  if (brent && wti) {
    const spread = brent.price - wti.price;
    parts.push(`The Brent-WTI spread sits at $${spread.toFixed(2)}/bbl.`);
  }

  if (ttf) {
    const dir = ttf.changePercent >= 0 ? 'up' : 'down';
    parts.push(`European gas (TTF) is ${dir} ${Math.abs(ttf.changePercent).toFixed(1)}%.`);
  }

  if (isAligned) {
    const direction = positiveCount > negativeCount ? 'firmer' : 'weaker';
    parts.push(`The energy complex is broadly ${direction}, with ${Math.max(positiveCount, negativeCount)} of ${energyCommodities.length} benchmarks moving in the same direction.`);
  } else {
    parts.push('Energy markets are mixed, with no clear directional consensus across benchmarks.');
  }

  // Hormuz correlation
  if (trends && brent) {
    const trafficDelta = trends.vessels.avg > 0 ? ((trends.vessels.current - trends.vessels.avg) / trends.vessels.avg) * 100 : 0;
    if (brent.changePercent > 1 && trafficDelta > 5) {
      parts.push('With both prices and physical traffic elevated, the market appears to be pricing genuine supply tightness rather than purely speculative risk.');
    } else if (brent.changePercent > 2 && trafficDelta < -5) {
      parts.push('Prices are rising despite below-average physical traffic — the premium may reflect geopolitical risk rather than actual supply disruption.');
    } else if (brent.changePercent < -1 && trafficDelta > 5) {
      parts.push('Prices are softening despite healthy physical flows, suggesting the market sees adequate supply.');
    }
  }

  // Note biggest mover if high-sensitivity
  if (biggestMover && Math.abs(biggestMover.changePercent) > 2 && biggestMover.hormuzSensitivity > 0.5) {
    parts.push(`Largest move: ${biggestMover.shortName} at ${biggestMover.changePercent > 0 ? '+' : ''}${biggestMover.changePercent.toFixed(1)}% (Hormuz sensitivity: ${Math.round(biggestMover.hormuzSensitivity * 100)}%).`);
  }

  return parts.join(' ');
}

function generateWeatherAssessment(
  current: WeatherCurrent | null,
  forecast: WeatherForecastDay[],
): string {
  if (!current) return 'Weather data unavailable.';

  const parts: string[] = [];

  const riskDesc = current.passageRisk === 'low' ? 'favorable' :
    current.passageRisk === 'moderate' ? 'moderate' :
    current.passageRisk === 'high' ? 'poor' : 'hazardous';

  parts.push(`Sea state is ${current.beaufortLabel} (Beaufort ${current.beaufort}) with ${current.waveHeight}m waves, winds at ${current.windSpeed} kn${current.windGusts > current.windSpeed * 1.3 ? ` gusting to ${current.windGusts} kn` : ''}, and ${current.visibility > 10 ? 'good' : current.visibility > 5 ? 'moderate' : 'reduced'} visibility (${current.visibility} km). Conditions are ${riskDesc} for transit.`);

  // Look ahead for weather deterioration
  if (forecast.length > 0) {
    const worstDay = forecast.reduce((worst, day) =>
      day.beaufortMax > worst.beaufortMax ? day : worst, forecast[0]);

    if (worstDay.passageRisk === 'high' || worstDay.passageRisk === 'severe') {
      parts.push(`Deterioration expected ${worstDay.label} with winds gusting to ${worstDay.windGustsMax} kn and waves up to ${worstDay.waveHeightMax}m. Passage risk elevated to ${worstDay.passageRisk}.`);
    } else if (worstDay.beaufortMax > current.beaufort + 2) {
      parts.push(`Conditions expected to worsen ${worstDay.label} with Beaufort ${worstDay.beaufortMax} and ${worstDay.waveHeightMax}m waves.`);
    } else {
      parts.push(`The 7-day outlook shows stable conditions with no significant weather events forecast.`);
    }
  }

  return parts.join(' ');
}

// ── Component ──

export default function AnalyticsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const vessels = useStore((s) => s.vessels);
  const transitHistory = useStore((s) => s.transitHistory);
  const historicalData = useStore((s) => s.historicalData);
  const storeCommodities = useStore((s) => s.commodities);
  const commodities = useMemo(
    () => storeCommodities.length > 0 ? storeCommodities : getMockCommodities(),
    [storeCommodities],
  );
  const weather = useStore((s) => s.weather);
  const [expandedCommodity, setExpandedCommodity] = useState<string | null>(null);

  // ── Data computations (preserved from original) ──

  const speedData = useMemo(() => {
    const buckets = [
      { range: '0-2', count: 0 }, { range: '2-6', count: 0 },
      { range: '6-10', count: 0 }, { range: '10-14', count: 0 }, { range: '14+', count: 0 },
    ];
    vessels.forEach((v) => {
      if (v.speed < 2) buckets[0].count++;
      else if (v.speed < 6) buckets[1].count++;
      else if (v.speed < 10) buckets[2].count++;
      else if (v.speed < 14) buckets[3].count++;
      else buckets[4].count++;
    });
    return buckets;
  }, [vessels]);

  const directionData = useMemo(() => {
    const moving = [...vessels.values()].filter((v) => v.speed > 0.5);
    const eastbound = moving.filter((v) => v.course >= 0 && v.course < 180).length;
    const westbound = moving.length - eastbound;
    const anchored = vessels.size - moving.length;
    return [
      { name: 'Eastbound', value: eastbound },
      { name: 'Westbound', value: westbound },
      { name: 'Anchored', value: anchored },
    ].filter((d) => d.value > 0);
  }, [vessels]);

  const transitTimeline = useMemo(() => {
    const now = Date.now();
    const hours: { hour: string; count: number }[] = [];
    for (let i = 23; i >= 0; i--) {
      const start = now - (i + 1) * 3600000;
      const end = now - i * 3600000;
      const count = transitHistory.filter((t) => t.timestamp >= start && t.timestamp < end).length;
      const d = new Date(end);
      hours.push({ hour: `${d.getHours().toString().padStart(2, '0')}:00`, count });
    }
    return hours;
  }, [transitHistory]);

  const dailyTransitData = useMemo(() => {
    if (!historicalData?.transitCounts) return [];
    return historicalData.transitCounts.map((d) => ({
      date: new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      eastbound: d.eastbound, westbound: d.westbound, total: d.total,
    }));
  }, [historicalData]);

  const dailyStatsData = useMemo(() => {
    if (!historicalData?.dailyStats) return [];
    return historicalData.dailyStats.map((d) => ({
      date: new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      peakVessels: d.peak_vessels, avgSpeed: d.avg_speed,
    }));
  }, [historicalData]);

  const anomalies = useMemo(() => {
    const items: Anomaly[] = [];
    const now = Date.now();
    vessels.forEach((v) => {
      if (v.speed > 16) {
        items.push({ type: 'High Speed', vessel: v.name, detail: `${v.speed.toFixed(1)} kn`, severity: 'alert' });
      }
      if (now - v.lastUpdate > 15 * 60_000) {
        const minsAgo = Math.round((now - v.lastUpdate) / 60_000);
        items.push({ type: 'Stale Position', vessel: v.name, detail: `${minsAgo}m ago`, severity: 'warn' });
      }
      if (v.speed < 0.3 && v.lon > 56.0 && v.lon < 57.1 && v.lat > 26.2 && v.lat < 26.7) {
        items.push({ type: 'Stopped in Lane', vessel: v.name, detail: 'Speed ~0 in TSS', severity: 'alert' });
      }
    });
    return items.slice(0, 12);
  }, [vessels]);

  const trends = useMemo(() => {
    if (!historicalData?.dailyStats || historicalData.dailyStats.length < 3) return null;
    const stats = historicalData.dailyStats;
    const avgVessels = stats.reduce((s, d) => s + d.peak_vessels, 0) / stats.length;
    const avgSpeed = stats.reduce((s, d) => s + d.avg_speed, 0) / stats.length;
    const avgEast = stats.reduce((s, d) => s + d.eastbound, 0) / stats.length;
    const avgWest = stats.reduce((s, d) => s + d.westbound, 0) / stats.length;
    const movingVessels = [...vessels.values()].filter(v => v.speed > 0.5);
    return {
      vessels: { current: vessels.size, avg: Math.round(avgVessels) },
      speed: { current: movingVessels.length > 0 ? movingVessels.reduce((s, v) => s + v.speed, 0) / movingVessels.length : 0, avg: Math.round(avgSpeed * 10) / 10 },
      eastbound: { current: transitHistory.filter(t => t.direction === 'eastbound' && Date.now() - t.timestamp < 86400000).length, avg: Math.round(avgEast) },
      westbound: { current: transitHistory.filter(t => t.direction === 'westbound' && Date.now() - t.timestamp < 86400000).length, avg: Math.round(avgWest) },
    };
  }, [vessels, historicalData, transitHistory]);

  const speedProfile = useMemo(() => {
    const speeds = [...vessels.values()].filter(v => v.speed > 0.5).map(v => v.speed);
    if (speeds.length === 0) return null;
    speeds.sort((a, b) => a - b);
    const mean = speeds.reduce((s, v) => s + v, 0) / speeds.length;
    const median = speeds[Math.floor(speeds.length / 2)];
    const variance = speeds.reduce((s, v) => s + (v - mean) ** 2, 0) / speeds.length;
    const stdDev = Math.sqrt(variance);
    return {
      mean: Math.round(mean * 10) / 10,
      median: Math.round(median * 10) / 10,
      stdDev: Math.round(stdDev * 10) / 10,
      min: Math.round(speeds[0] * 10) / 10,
      max: Math.round(speeds[speeds.length - 1] * 10) / 10,
      normalLow: Math.round((mean - stdDev) * 10) / 10,
      normalHigh: Math.round((mean + stdDev) * 10) / 10,
      count: speeds.length,
    };
  }, [vessels]);

  const flagData = useMemo(() => {
    const counts: Record<string, number> = {};
    vessels.forEach((v) => { counts[v.flag || 'Unknown'] = (counts[v.flag || 'Unknown'] || 0) + 1; });
    return Object.entries(counts)
      .map(([flag, count]) => ({ flag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [vessels]);

  // Fleet composition by vessel category
  const fleetComposition = useMemo(() => {
    const counts: Record<string, number> = {};
    vessels.forEach((v) => {
      const cat = v.category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [vessels]);

  // Commodity data sorted by Hormuz sensitivity
  const sortedCommodities = useMemo(() =>
    [...commodities].sort((a, b) => b.hormuzSensitivity - a.hormuzSensitivity),
  [commodities]);

  const riskPremium = useMemo(() => computeRiskPremium(commodities), [commodities]);
  const riskSeverity = useMemo(() => {
    const sev = getSeverity(riskPremium.percentImpact);
    return sev;
  }, [riskPremium]);

  // ── Analysis text ──

  const execSummary = useMemo(
    () => generateExecutiveSummary(vessels, trends, anomalies, commodities, weather),
    [vessels, trends, anomalies, commodities, weather],
  );
  const trafficAnalysis = useMemo(
    () => generateTrafficAnalysis(vessels, trends, speedProfile),
    [vessels, trends, speedProfile],
  );
  const anomalyAnalysis = useMemo(
    () => generateAnomalyAnalysis(anomalies, vessels.size),
    [anomalies, vessels.size],
  );
  const marketAnalysis = useMemo(
    () => generateMarketAnalysis(commodities, trends),
    [commodities, trends],
  );
  const weatherAssessment = useMemo(
    () => generateWeatherAssessment(weather.current, weather.daily),
    [weather],
  );

  const shippingForecast = useMemo(() => {
    if (!weather.current) return null;
    return generateShippingForecast(weather.current, weather.daily);
  }, [weather]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-base animate-fade-in flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-sm font-bold uppercase tracking-widest">
            <span className="text-accent">Hormuz Strait</span>
            <span className="text-text-dim ml-2">— Intelligence Report</span>
          </h1>
          <div className="text-[10px] text-text-dim mt-0.5 font-mono">
            Generated {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} UTC
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-text-dim hover:text-text-primary transition-colors p-1.5 rounded-sm hover:bg-surface-2"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Content — fills remaining height */}
      <div className="flex-1 min-h-0 flex flex-col p-4 gap-4">

        {/* ═══ EXECUTIVE SUMMARY — full width ═══ */}
        <section className="flex-shrink-0">
          <SectionHeader title="Executive Summary" />
          <AnalysisProse>{execSummary}</AnalysisProse>
        </section>

        {/* ═══ 2-COLUMN LAYOUT — fills remaining space ═══ */}
        <div className="flex-1 min-h-0 grid grid-cols-[3fr_2fr] gap-4">

          {/* ── LEFT COLUMN: Traffic + Vessels ── */}
          <div className="overflow-y-auto space-y-4 pr-2">

            {/* TRAFFIC INTELLIGENCE */}
            <section>
              <SectionHeader title="Traffic Intelligence" />

              {/* Key stats row */}
              <div className="grid grid-cols-5 gap-2 mb-3">
                <StatCard label="Total Vessels" value={vessels.size} />
                <StatCard label="Eastbound" value={directionData.find(d => d.name === 'Eastbound')?.value ?? 0} />
                <StatCard label="Westbound" value={directionData.find(d => d.name === 'Westbound')?.value ?? 0} />
                <StatCard label="Anchored" value={directionData.find(d => d.name === 'Anchored')?.value ?? 0} />
                <StatCard label="Avg Speed" value={speedProfile ? `${speedProfile.mean} kn` : '—'} />
              </div>

              {/* Trend comparison */}
              {trends && (
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {([
                    { label: 'Vessels', current: trends.vessels.current, avg: trends.vessels.avg },
                    { label: 'Avg Speed', current: Number(trends.speed.current.toFixed(1)), avg: trends.speed.avg },
                    { label: 'Eastbound/day', current: trends.eastbound.current, avg: trends.eastbound.avg },
                    { label: 'Westbound/day', current: trends.westbound.current, avg: trends.westbound.avg },
                  ] as const).map((t) => {
                    const diff = t.avg > 0 ? ((t.current - t.avg) / t.avg) * 100 : 0;
                    const isUp = diff > 5;
                    const isDown = diff < -5;
                    return (
                      <div key={t.label} className="bg-surface-1 rounded-sm p-2.5 border border-border">
                        <div className="text-[10px] text-text-dim mb-1">{t.label}</div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-bold text-white">{t.current}</span>
                          <span className={`text-[10px] font-medium ${isUp ? 'text-status-nominal' : isDown ? 'text-status-crit' : 'text-text-dim'}`}>
                            {isUp ? '\u25B2' : isDown ? '\u25BC' : '\u25CF'} {Math.abs(Math.round(diff))}%
                          </span>
                        </div>
                        <div className="text-[10px] text-text-dim">30d avg: {t.avg}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              <AnalysisProse>{trafficAnalysis}</AnalysisProse>

              {/* Charts: Speed + Direction side by side */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <ChartCard title="Speed Distribution (knots)">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={speedData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                      <XAxis dataKey="range" tick={axisProps} axisLine={false} tickLine={false} />
                      <YAxis tick={axisProps} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill="#00b4d8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Traffic Direction">
                  <div className="flex items-center justify-center gap-6">
                    <ResponsiveContainer width="45%" height={140}>
                      <PieChart>
                        <Pie data={directionData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={3} dataKey="value">
                          {directionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2">
                      {directionData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-xs text-text-secondary">
                            {d.name}: <span className="text-text-primary font-semibold">{d.value}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </ChartCard>
              </div>

              {/* Speed Profile */}
              {speedProfile && (
                <div className="mt-2">
                  <ChartCard title="Speed Profile (Moving Vessels)">
                    <div className="flex items-center gap-6">
                      <div className="grid grid-cols-5 gap-3 flex-1">
                        {[
                          { label: 'Mean', value: `${speedProfile.mean} kn` },
                          { label: 'Median', value: `${speedProfile.median} kn` },
                          { label: 'Std Dev', value: `\u00B1${speedProfile.stdDev} kn` },
                          { label: 'Min', value: `${speedProfile.min} kn` },
                          { label: 'Max', value: `${speedProfile.max} kn` },
                        ].map((s) => (
                          <div key={s.label} className="text-center">
                            <div className="text-sm font-bold text-white">{s.value}</div>
                            <div className="text-[10px] text-text-dim">{s.label}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex-1 max-w-[40%]">
                        <div className="text-[10px] text-text-dim mb-1.5">Normal Range ({speedProfile.count} vessels)</div>
                        <div className="relative h-3 bg-surface-1 rounded-sm overflow-hidden border border-border">
                          <div
                            className="absolute h-full bg-accent/30 rounded-sm"
                            style={{
                              left: `${(Math.max(0, speedProfile.normalLow) / 20) * 100}%`,
                              width: `${((speedProfile.normalHigh - Math.max(0, speedProfile.normalLow)) / 20) * 100}%`,
                            }}
                          />
                          <div
                            className="absolute h-full w-0.5 bg-accent"
                            style={{ left: `${(speedProfile.mean / 20) * 100}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] text-text-dim mt-0.5">
                          <span>0</span>
                          <span className="text-accent">{speedProfile.normalLow}–{speedProfile.normalHigh} kn</span>
                          <span>20</span>
                        </div>
                      </div>
                    </div>
                  </ChartCard>
                </div>
              )}

              {/* Daily Transits (30d) */}
              {dailyTransitData.length > 0 && (
                <div className="mt-2">
                  <ChartCard title="Daily Transits (30d)">
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={dailyTransitData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                        <XAxis dataKey="date" tick={axisProps} axisLine={false} tickLine={false} interval={4} />
                        <YAxis tick={axisProps} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }} />
                        <Bar dataKey="eastbound" fill="#00b4d8" radius={[2, 2, 0, 0]} stackId="a" />
                        <Bar dataKey="westbound" fill="#f59e0b" radius={[2, 2, 0, 0]} stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              )}

              {/* Transit Timeline (24h) */}
              <div className="mt-2">
                <ChartCard title="Strait Transits (24h)">
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={transitTimeline} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                      <XAxis dataKey="hour" tick={axisProps} axisLine={false} tickLine={false} interval={3} />
                      <YAxis tick={axisProps} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="count" stroke="#ffab00" fill="#ffab00" fillOpacity={0.15} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* Peak Vessels & Avg Speed (30d) */}
              {dailyStatsData.length > 0 && (
                <div className="mt-2">
                  <ChartCard title="Peak Vessels & Avg Speed (30d)">
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={dailyStatsData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                        <XAxis dataKey="date" tick={axisProps} axisLine={false} tickLine={false} interval={4} />
                        <YAxis tick={axisProps} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }} />
                        <Line type="monotone" dataKey="peakVessels" stroke="#00e676" strokeWidth={2} dot={false} name="Peak Vessels" />
                        <Line type="monotone" dataKey="avgSpeed" stroke="#7c4dff" strokeWidth={2} dot={false} name="Avg Speed (kn)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              )}
            </section>

            {/* VESSEL INTELLIGENCE */}
            <section>
              <SectionHeader title="Vessel Intelligence" />

              <div className="grid grid-cols-2 gap-2">
                <ChartCard title="Fleet Composition">
                  {fleetComposition.length > 0 ? (
                    <div className="space-y-1.5">
                      {fleetComposition.map((d, i) => (
                        <div key={d.category} className="flex items-center gap-2">
                          <span className="text-xs text-text-secondary w-24 truncate">{d.category}</span>
                          <div className="flex-1 h-4 bg-surface-1 rounded-sm overflow-hidden">
                            <div className="h-full rounded-sm transition-all" style={{ width: `${(d.count / (fleetComposition[0]?.count || 1)) * 100}%`, backgroundColor: COLORS[i % COLORS.length], opacity: 0.8 }} />
                          </div>
                          <span className="text-xs font-data font-semibold text-text-primary">{d.count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-text-dim text-center py-6">No vessel data</div>
                  )}
                </ChartCard>

                <ChartCard title="Vessels by Flag">
                  {flagData.length > 0 ? (
                    <div className="space-y-1.5">
                      {flagData.map((d, i) => (
                        <div key={d.flag} className="flex items-center gap-2">
                          <span className="text-xs text-text-secondary w-16 truncate">{d.flag}</span>
                          <div className="flex-1 h-4 bg-surface-1 rounded-sm overflow-hidden">
                            <div className="h-full rounded-sm transition-all" style={{ width: `${(d.count / (flagData[0]?.count || 1)) * 100}%`, backgroundColor: COLORS[i % COLORS.length], opacity: 0.8 }} />
                          </div>
                          <span className="text-xs font-data font-semibold text-text-primary">{d.count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-text-dim text-center py-6">No vessel data</div>
                  )}
                </ChartCard>
              </div>

              {historicalData?.topVessels && historicalData.topVessels.length > 0 && (
                <div className="mt-2">
                  <ChartCard title="Most Frequent Vessels (30d)">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {historicalData.topVessels.slice(0, 10).map((v, i) => (
                        <div key={v.mmsi} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-text-dim w-5">{i + 1}.</span>
                            <span className="text-text-primary truncate">{v.name}</span>
                            <span className="text-text-dim">{v.flag}</span>
                          </div>
                          <span className="text-accent font-data font-semibold">{v.transit_count}x</span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                </div>
              )}
            </section>

            {/* DATABASE & COVERAGE */}
            {historicalData?.dbStats && (
              <section>
                <SectionHeader title="Database & Coverage" />
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="Positions Recorded" value={historicalData.dbStats.positions.toLocaleString()} />
                  <StatCard label="Transits Detected" value={historicalData.dbStats.transits.toLocaleString()} />
                  <StatCard label="Collecting Since" value={historicalData.dbStats.oldestRecord ? new Date(historicalData.dbStats.oldestRecord).toLocaleDateString() : 'N/A'} />
                </div>
              </section>
            )}
          </div>

          {/* ── RIGHT COLUMN: Markets + Weather + Alerts ── */}
          <div className="overflow-y-auto space-y-4 pr-2">

            {/* COMMODITY & RISK INTELLIGENCE */}
            <section>
              <SectionHeader title="Commodity & Risk Intelligence" />

              {/* Risk Premium */}
              <div className={`bg-surface-1 rounded-sm border p-3 mb-3 ${
                riskSeverity === 'crit' ? 'border-status-crit/50' :
                riskSeverity === 'warn' ? 'border-status-warn/50' : 'border-border'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-text-dim uppercase tracking-wider mb-1">Hormuz Risk Premium</div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-lg font-bold ${
                        riskSeverity === 'crit' ? 'text-status-crit' :
                        riskSeverity === 'warn' ? 'text-status-warn' : 'text-status-nominal'
                      }`}>
                        {riskPremium.dollarImpact >= 0 ? '+' : ''}${riskPremium.dollarImpact.toFixed(2)} / bbl
                      </span>
                      <span className="text-xs text-text-dim">
                        ({riskPremium.percentImpact >= 0 ? '+' : ''}{riskPremium.percentImpact.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      riskSeverity === 'crit' ? 'bg-status-crit animate-pulse' :
                      riskSeverity === 'warn' ? 'bg-status-warn' : 'bg-status-nominal'
                    }`} />
                    <span className="text-xs text-text-dim uppercase">
                      {riskSeverity === 'crit' ? 'Critical' : riskSeverity === 'warn' ? 'Elevated' : 'Nominal'}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-text-dim mt-1">Weighted avg. commodity movement × strait sensitivity</div>
              </div>

              {/* Commodity Table */}
              {sortedCommodities.length > 0 && (
                <div className="bg-surface-1 rounded-sm border border-border overflow-hidden mb-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-[10px] text-text-dim uppercase tracking-wider p-2">Commodity</th>
                        <th className="text-right text-[10px] text-text-dim uppercase tracking-wider p-2">Price</th>
                        <th className="text-right text-[10px] text-text-dim uppercase tracking-wider p-2">24h</th>
                        <th className="text-right text-[10px] text-text-dim uppercase tracking-wider p-2">Sensitivity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCommodities.map((c) => {
                        const isUp = c.changePercent >= 0;
                        const isExpanded = expandedCommodity === c.symbol;
                        const sparkColor = isUp ? '#00e676' : '#ff1744';
                        return (
                          <tr key={c.symbol} className="border-b border-border/50 group">
                            <td colSpan={4} className="p-0">
                              <button
                                onClick={() => setExpandedCommodity(isExpanded ? null : c.symbol)}
                                className="w-full grid grid-cols-[1fr_auto_auto_auto] items-center p-2 hover:bg-surface-2/50 text-left"
                              >
                                <div>
                                  <div className="text-xs text-text-primary font-medium">{c.shortName}</div>
                                  <div className="text-[10px] text-text-dim">{c.unit}</div>
                                </div>
                                <div className="text-xs text-right font-data text-text-primary px-2">
                                  {formatCommodityPrice(c.price, c.symbol)}
                                </div>
                                <div className={`text-xs text-right font-data font-semibold px-2 ${
                                  c.changePercent > 0 ? 'text-status-nominal' : c.changePercent < 0 ? 'text-status-crit' : 'text-text-dim'
                                }`}>
                                  {c.changePercent > 0 ? '+' : ''}{c.changePercent.toFixed(2)}%
                                </div>
                                <div className="flex items-center justify-end gap-1.5 px-2">
                                  <div className="w-12 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${c.hormuzSensitivity * 100}%`, backgroundColor: c.hormuzSensitivity >= 0.8 ? '#ff1744' : c.hormuzSensitivity >= 0.5 ? '#ffab00' : '#4a5e78' }} />
                                  </div>
                                  <span className="text-[10px] text-text-dim font-data">{Math.round(c.hormuzSensitivity * 100)}%</span>
                                </div>
                              </button>
                              {isExpanded && (
                                <div className="px-2 pb-2 space-y-2">
                                  {c.history.length > 2 && (
                                    <div className="h-20">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={c.history} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
                                          <XAxis dataKey="timestamp" hide />
                                          <Tooltip
                                            contentStyle={tooltipStyle}
                                            formatter={(val: unknown) => [formatCommodityPrice(Number(val), c.symbol), 'Price']}
                                            labelFormatter={(ts) => new Date(Number(ts)).toLocaleDateString()}
                                          />
                                          <Area type="monotone" dataKey="price" stroke={sparkColor} fill={sparkColor} fillOpacity={0.15} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                                        </AreaChart>
                                      </ResponsiveContainer>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-4 gap-1 text-center">
                                    {[
                                      { label: 'Open', val: c.open24h },
                                      { label: 'High', val: c.high24h, color: '#00e676' },
                                      { label: 'Low', val: c.low24h, color: '#ff1744' },
                                      { label: 'Current', val: c.price, color: sparkColor },
                                    ].map((o) => (
                                      <div key={o.label} className="bg-surface-2/50 rounded-sm px-1.5 py-1">
                                        <div className="text-[9px] text-text-dim uppercase">{o.label}</div>
                                        <div className="text-[11px] font-data" style={{ color: o.color ?? '#e0e8f0' }}>
                                          {formatCommodityPrice(o.val, c.symbol)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <AnalysisProse>{marketAnalysis}</AnalysisProse>
            </section>

            {/* SHIPPING FORECAST */}
            {shippingForecast && (
              <section>
                <SectionHeader title="Shipping Forecast" />
                <div className="bg-surface-1 rounded-sm border border-accent/20 p-3 font-mono text-[10px] leading-relaxed text-accent/80 whitespace-pre-wrap">
                  {shippingForecast.text}
                </div>
              </section>
            )}

            {/* MARITIME CONDITIONS */}
            <section>
              <SectionHeader title="Maritime Conditions" />

              {weather.current ? (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <StatCard label="Wind" value={`${weather.current.windSpeed} kn`} />
                    <StatCard label="Gusts" value={`${weather.current.windGusts} kn`} />
                    <StatCard label="Waves" value={`${weather.current.waveHeight}m`} />
                    <StatCard label="Visibility" value={`${weather.current.visibility} km`} />
                    <StatCard label="Beaufort" value={weather.current.beaufort} />
                    <StatCard
                      label="Passage Risk"
                      value={weather.current.passageRisk.toUpperCase()}
                      valueColor={
                        weather.current.passageRisk === 'low' ? 'text-status-nominal' :
                        weather.current.passageRisk === 'moderate' ? 'text-status-warn' :
                        'text-status-crit'
                      }
                    />
                  </div>

                  {weather.daily.length > 0 && (
                    <div className="grid grid-cols-5 gap-1.5 mb-3">
                      {weather.daily.map((day) => (
                        <div key={day.date} className={`bg-surface-1 rounded-sm border p-2 text-center ${
                          day.passageRisk === 'high' || day.passageRisk === 'severe' ? 'border-status-crit/40' : 'border-border'
                        }`}>
                          <div className="text-[10px] text-text-dim mb-1">{day.label}</div>
                          <div className="text-xs font-bold text-white">{day.windSpeedMax} kn</div>
                          <div className="text-[10px] text-text-dim">{day.waveHeightMax}m</div>
                          <div className={`text-[9px] mt-1 uppercase font-medium ${
                            day.passageRisk === 'low' ? 'text-status-nominal' :
                            day.passageRisk === 'moderate' ? 'text-status-warn' :
                            'text-status-crit'
                          }`}>
                            {day.passageRisk}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <AnalysisProse>{weatherAssessment}</AnalysisProse>
                </>
              ) : (
                <div className="text-xs text-text-dim py-4">Weather data loading...</div>
              )}
            </section>

            {/* ANOMALIES & ALERTS */}
            <section>
              <SectionHeader title="Anomalies & Alerts" />

              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${
                  vessels.size === 0 ? 'bg-text-dim' :
                  anomalies.length > 0 ? 'bg-status-warn animate-pulse' : 'bg-status-nominal'
                }`} />
                <span className="text-xs text-text-secondary">
                  {vessels.size === 0
                    ? 'No AIS data — anomaly detection offline'
                    : anomalies.length > 0
                      ? `${anomalies.length} anomal${anomalies.length === 1 ? 'y' : 'ies'} detected`
                      : 'No vessel-level anomalies in current data'}
                </span>
              </div>

              {anomalies.length > 0 && (
                <div className="bg-surface-1 rounded-sm border border-border p-2.5 mb-3">
                  <div className="space-y-1.5">
                    {anomalies.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`w-1.5 h-1.5 rounded-sm flex-shrink-0 ${a.severity === 'alert' ? 'bg-status-crit' : 'bg-status-warn'}`} />
                        <span className="text-text-secondary flex-shrink-0">{a.type}</span>
                        <span className="text-text-primary truncate">{a.vessel}</span>
                        <span className="text-text-dim ml-auto flex-shrink-0">{a.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <AnalysisProse>{anomalyAnalysis}</AnalysisProse>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared UI components ──

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">{title}</h2>
      <div className="h-px bg-border mt-1.5" />
    </div>
  );
}

function AnalysisProse({ children }: { children: string }) {
  return (
    <div className="border-l-2 border-accent/30 pl-3 py-1.5">
      <p className="text-xs leading-relaxed text-text-secondary">{children}</p>
    </div>
  );
}

function StatCard({ label, value, valueColor }: { label: string; value: string | number; valueColor?: string }) {
  return (
    <div className="bg-surface-1 rounded-sm border border-border p-2.5 text-center">
      <div className="text-[10px] text-text-dim mb-0.5">{label}</div>
      <div className={`text-sm font-bold ${valueColor ?? 'text-white'}`}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-1 rounded-sm border border-border border-t-2 border-t-accent p-2.5">
      <h3 className="label-caps mb-2">{title}</h3>
      {children}
    </div>
  );
}
