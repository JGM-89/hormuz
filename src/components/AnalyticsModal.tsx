import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend,
} from 'recharts';
import { useStore } from '../store';

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

export default function AnalyticsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const vessels = useStore((s) => s.vessels);
  const transitHistory = useStore((s) => s.transitHistory);
  const historicalData = useStore((s) => s.historicalData);

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

  // Anomaly detection
  const anomalies = useMemo(() => {
    const items: { type: string; vessel: string; detail: string; severity: 'warn' | 'alert' }[] = [];
    const now = Date.now();
    vessels.forEach((v) => {
      // Unusually fast
      if (v.speed > 16) {
        items.push({ type: 'High Speed', vessel: v.name, detail: `${v.speed.toFixed(1)} kn`, severity: 'alert' });
      }
      // Stale position (>15 min)
      if (now - v.lastUpdate > 15 * 60_000) {
        const minsAgo = Math.round((now - v.lastUpdate) / 60_000);
        items.push({ type: 'Stale Position', vessel: v.name, detail: `${minsAgo}m ago`, severity: 'warn' });
      }
      // Stationary in shipping lane (speed 0 but in transit zone lon 56-57)
      if (v.speed < 0.3 && v.lon > 56.0 && v.lon < 57.1 && v.lat > 26.2 && v.lat < 26.7) {
        items.push({ type: 'Stopped in Lane', vessel: v.name, detail: 'Speed ~0 in TSS', severity: 'alert' });
      }
    });
    return items.slice(0, 8);
  }, [vessels]);

  // Trend comparison (current vs historical averages)
  const trends = useMemo(() => {
    if (!historicalData?.dailyStats || historicalData.dailyStats.length < 3) return null;
    const stats = historicalData.dailyStats;
    const avgVessels = stats.reduce((s, d) => s + d.peak_vessels, 0) / stats.length;
    const avgSpeed = stats.reduce((s, d) => s + d.avg_speed, 0) / stats.length;
    const avgEast = stats.reduce((s, d) => s + d.eastbound, 0) / stats.length;
    const avgWest = stats.reduce((s, d) => s + d.westbound, 0) / stats.length;
    return {
      vessels: { current: vessels.size, avg: Math.round(avgVessels) },
      speed: { current: [...vessels.values()].filter(v => v.speed > 0.5).reduce((s, v) => s + v.speed, 0) / Math.max([...vessels.values()].filter(v => v.speed > 0.5).length, 1), avg: Math.round(avgSpeed * 10) / 10 },
      eastbound: { current: transitHistory.filter(t => t.direction === 'eastbound' && Date.now() - t.timestamp < 86400000).length, avg: Math.round(avgEast) },
      westbound: { current: transitHistory.filter(t => t.direction === 'westbound' && Date.now() - t.timestamp < 86400000).length, avg: Math.round(avgWest) },
    };
  }, [vessels, historicalData, transitHistory]);

  // Enhanced speed profiling
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

  // Flag state breakdown
  const flagData = useMemo(() => {
    const counts: Record<string, number> = {};
    vessels.forEach((v) => { counts[v.flag || 'Unknown'] = (counts[v.flag || 'Unknown'] || 0) + 1; });
    return Object.entries(counts)
      .map(([flag, count]) => ({ flag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [vessels]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-base animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <h1 className="text-sm font-bold uppercase tracking-widest">
          <span className="text-accent">Analytics</span>
          <span className="text-text-dim ml-2">Dashboard</span>
        </h1>
        <button
          onClick={onClose}
          className="text-text-dim hover:text-text-primary transition-colors p-1.5 rounded-sm hover:bg-surface-2"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 h-[calc(100vh-48px)] overflow-y-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-3 gap-2">
          {/* Speed Distribution */}
          <ChartCard title="Speed Distribution (knots)">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={speedData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                <XAxis dataKey="range" tick={axisProps} axisLine={false} tickLine={false} />
                <YAxis tick={axisProps} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#00b4d8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Direction Breakdown */}
          <ChartCard title="Traffic Direction">
            <div className="flex items-center justify-center gap-6">
              <ResponsiveContainer width="45%" height={160}>
                <PieChart>
                  <Pie data={directionData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
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

          {/* Transit Timeline */}
          <ChartCard title="Strait Transits (24h)">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={transitTimeline} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                <XAxis dataKey="hour" tick={axisProps} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={axisProps} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="#ffab00" fill="#ffab00" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Flag State Breakdown */}
          <ChartCard title="Vessels by Flag">
            {flagData.length > 0 ? (
              <div className="space-y-1.5">
                {flagData.map((d, i) => (
                  <div key={d.flag} className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary w-16 truncate">{d.flag}</span>
                    <div className="flex-1 h-4 bg-surface-1 rounded-sm overflow-hidden">
                      <div
                        className="h-full rounded-sm transition-all"
                        style={{
                          width: `${(d.count / (flagData[0]?.count || 1)) * 100}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                          opacity: 0.8,
                        }}
                      />
                    </div>
                    <span className="text-xs font-data font-semibold text-text-primary w-6 text-right">{d.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-text-dim text-center py-6">No vessel data</div>
            )}
          </ChartCard>

          {/* Anomaly Detection */}
          <ChartCard title="Anomalies & Alerts">
            {anomalies.length > 0 ? (
              <div className="space-y-1.5">
                {anomalies.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-sm flex-shrink-0 ${a.severity === 'alert' ? 'bg-status-crit' : 'bg-status-warn'}`} />
                    <span className="text-text-secondary w-24 flex-shrink-0">{a.type}</span>
                    <span className="text-text-primary truncate">{a.vessel}</span>
                    <span className="text-text-dim ml-auto flex-shrink-0">{a.detail}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-text-dim text-center py-6">No anomalies detected</div>
            )}
          </ChartCard>

          {/* Trend Comparison */}
          <ChartCard title="Current vs 30-Day Average">
            {trends ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Vessels', current: trends.vessels.current, avg: trends.vessels.avg },
                  { label: 'Avg Speed', current: trends.speed.current.toFixed(1), avg: trends.speed.avg },
                  { label: 'Eastbound/day', current: trends.eastbound.current, avg: trends.eastbound.avg },
                  { label: 'Westbound/day', current: trends.westbound.current, avg: trends.westbound.avg },
                ].map((t) => {
                  const curr = typeof t.current === 'string' ? parseFloat(t.current) : t.current;
                  const diff = t.avg > 0 ? ((curr - t.avg) / t.avg) * 100 : 0;
                  const isUp = diff > 5;
                  const isDown = diff < -5;
                  return (
                    <div key={t.label} className="bg-surface-1 rounded-sm p-2.5">
                      <div className="text-[10px] text-text-dim mb-1">{t.label}</div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-bold text-white">{t.current}</span>
                        <span className={`text-[10px] font-medium ${isUp ? 'text-status-nominal' : isDown ? 'text-status-crit' : 'text-text-dim'}`}>
                          {isUp ? '\u25B2' : isDown ? '\u25BC' : '\u25CF'} {Math.abs(Math.round(diff))}%
                        </span>
                      </div>
                      <div className="text-[10px] text-text-dim">avg: {t.avg}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-text-dim text-center py-6">Insufficient historical data</div>
            )}
          </ChartCard>

          {/* Speed Profiling */}
          <ChartCard title="Speed Profile (Moving Vessels)">
            {speedProfile ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Mean', value: `${speedProfile.mean} kn` },
                    { label: 'Median', value: `${speedProfile.median} kn` },
                    { label: 'Std Dev', value: `\u00B1${speedProfile.stdDev} kn` },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <div className="text-sm font-bold text-white">{s.value}</div>
                      <div className="text-[10px] text-text-dim">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-surface-1 rounded-sm p-2">
                  <div className="text-[10px] text-text-dim mb-1.5">Normal Range ({speedProfile.count} vessels)</div>
                  <div className="relative h-3 bg-surface-1 rounded-sm overflow-hidden">
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
                    <span>0 kn</span>
                    <span className="text-accent">{speedProfile.normalLow}–{speedProfile.normalHigh} kn</span>
                    <span>20 kn</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-text-dim text-center py-6">No moving vessels</div>
            )}
          </ChartCard>

          {/* Historical: Daily Transits */}
          {dailyTransitData.length > 0 && (
            <ChartCard title="Daily Transits (30d)">
              <ResponsiveContainer width="100%" height={180}>
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
          )}

          {/* Historical: Peak Vessels & Avg Speed */}
          {dailyStatsData.length > 0 && (
            <ChartCard title="Peak Vessels & Avg Speed (30d)">
              <ResponsiveContainer width="100%" height={180}>
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
          )}

          {/* Top Vessels */}
          {historicalData?.topVessels && historicalData.topVessels.length > 0 && (
            <ChartCard title="Most Frequent Vessels (30d)">
              <div className="space-y-1.5">
                {historicalData.topVessels.slice(0, 10).map((v, i) => (
                  <div key={v.mmsi} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-text-dim w-5">{i + 1}.</span>
                      <span className="text-text-primary truncate max-w-[180px]">{v.name}</span>
                      <span className="text-text-dim">{v.flag}</span>
                    </div>
                    <span className="text-accent font-data font-semibold">{v.transit_count}x</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}

          {/* DB Stats */}
          {historicalData?.dbStats && (
            <ChartCard title="Database">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-text-dim">Positions recorded</span>
                <span className="text-text-primary text-right font-data">{historicalData.dbStats.positions.toLocaleString()}</span>
                <span className="text-text-dim">Transits detected</span>
                <span className="text-text-primary text-right font-data">{historicalData.dbStats.transits.toLocaleString()}</span>
                <span className="text-text-dim">Collecting since</span>
                <span className="text-text-primary text-right font-data">
                  {historicalData.dbStats.oldestRecord ? new Date(historicalData.dbStats.oldestRecord).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </ChartCard>
          )}
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-1 rounded-sm border border-border border-t-2 border-t-accent p-2.5">
      <h3 className="label-caps mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}
