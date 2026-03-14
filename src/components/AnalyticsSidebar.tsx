import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { useStore } from '../store';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const COLORS = ['#00b4d8', '#ffab00', '#00e676', '#7c4dff', '#ff6e40', '#448aff'];
const tooltipStyle = {
  backgroundColor: '#0c1e3a',
  border: '1px solid #1a3a5c',
  borderRadius: 2,
  fontSize: 10,
  fontFamily: '"JetBrains Mono", monospace',
  color: '#e0e8f0',
};
const axisProps = { fontSize: 9, fill: '#4a5e78', fontFamily: '"JetBrains Mono", monospace' };

export default function AnalyticsSidebar({ onExpandClick }: { onExpandClick: () => void }) {
  const vessels = useStore((s) => s.vessels);
  const transitHistory = useStore((s) => s.transitHistory);
  const historicalData = useStore((s) => s.historicalData);
  const [section, setSection] = useState<'charts' | 'anomalies'>('charts');

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
      { name: 'East', value: eastbound },
      { name: 'West', value: westbound },
      { name: 'Anch', value: anchored },
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
      hours.push({ hour: `${d.getHours().toString().padStart(2, '0')}`, count });
    }
    return hours;
  }, [transitHistory]);

  const anomalies = useMemo(() => {
    const items: { type: string; vessel: string; detail: string; severity: 'warn' | 'alert' }[] = [];
    const now = Date.now();
    vessels.forEach((v) => {
      if (v.speed > 16) {
        items.push({ type: 'HIGH SPD', vessel: v.name, detail: `${v.speed.toFixed(1)}kn`, severity: 'alert' });
      }
      if (now - v.lastUpdate > 15 * 60_000) {
        const minsAgo = Math.round((now - v.lastUpdate) / 60_000);
        items.push({ type: 'STALE', vessel: v.name, detail: `${minsAgo}m`, severity: 'warn' });
      }
      if (v.speed < 0.3 && v.lon > 56.0 && v.lon < 57.1 && v.lat > 26.2 && v.lat < 26.7) {
        items.push({ type: 'STOPPED', vessel: v.name, detail: 'In TSS', severity: 'alert' });
      }
    });
    return items.slice(0, 10);
  }, [vessels]);

  const trends = useMemo(() => {
    if (!historicalData?.dailyStats || historicalData.dailyStats.length < 3) return null;
    const stats = historicalData.dailyStats;
    const avgVessels = stats.reduce((s, d) => s + d.peak_vessels, 0) / stats.length;
    const avgSpeed = stats.reduce((s, d) => s + d.avg_speed, 0) / stats.length;
    const movingVessels = [...vessels.values()].filter(v => v.speed > 0.5);
    const currentSpeed = movingVessels.length > 0
      ? movingVessels.reduce((s, v) => s + v.speed, 0) / movingVessels.length : 0;
    return {
      vessels: { current: vessels.size, avg: Math.round(avgVessels) },
      speed: { current: Math.round(currentSpeed * 10) / 10, avg: Math.round(avgSpeed * 10) / 10 },
    };
  }, [vessels, historicalData]);

  return (
    <div className="flex flex-col h-full">
      {/* Section tabs */}
      <div className="flex gap-1 px-2.5 py-1.5 border-b border-border-dim flex-shrink-0">
        <TabBtn active={section === 'charts'} onClick={() => setSection('charts')}>Charts</TabBtn>
        <TabBtn active={section === 'anomalies'} onClick={() => setSection('anomalies')}>
          Alerts {anomalies.length > 0 && <span className="text-status-crit ml-1">{anomalies.length}</span>}
        </TabBtn>
        <button
          onClick={onExpandClick}
          className="ml-auto text-[10px] text-text-dim hover:text-accent uppercase tracking-wider font-semibold transition-colors px-2 py-0.5 rounded-sm hover:bg-surface-2"
          title="Open full analytics dashboard"
        >
          Expand
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {section === 'charts' ? (
          <>
            {/* Trend cards */}
            {trends && (
              <div className="grid grid-cols-2 gap-1.5">
                <TrendCard label="Vessels" current={trends.vessels.current} avg={trends.vessels.avg} />
                <TrendCard label="Avg Speed" current={trends.speed.current} avg={trends.speed.avg} unit="kn" />
              </div>
            )}

            {/* Speed distribution */}
            <MiniCard title="Speed Distribution">
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={speedData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="range" tick={axisProps} axisLine={false} tickLine={false} />
                  <YAxis tick={axisProps} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#00b4d8" radius={[1, 1, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </MiniCard>

            {/* Traffic direction */}
            <MiniCard title="Traffic Direction">
              <div className="flex items-center gap-3">
                <ResponsiveContainer width="50%" height={80}>
                  <PieChart>
                    <Pie data={directionData} cx="50%" cy="50%" innerRadius={20} outerRadius={35} paddingAngle={3} dataKey="value">
                      {directionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1">
                  {directionData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-[10px] text-text-dim">
                        {d.name}: <span className="text-text-primary font-data font-semibold">{d.value}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </MiniCard>

            {/* Transit timeline */}
            <MiniCard title="Transits (24h)">
              <ResponsiveContainer width="100%" height={80}>
                <AreaChart data={transitTimeline} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="hour" tick={axisProps} axisLine={false} tickLine={false} interval={5} />
                  <YAxis tick={axisProps} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <defs>
                    <linearGradient id="transitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffab00" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ffab00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="count" stroke="#ffab00" fill="url(#transitGrad)" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </MiniCard>
          </>
        ) : (
          <>
            {/* Anomalies list */}
            {anomalies.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-text-dim text-[11px] gap-1">
                <div className="led led-live" />
                <span className="mt-2">No anomalies detected</span>
              </div>
            ) : (
              <div className="space-y-1">
                {anomalies.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] bg-surface-1 rounded-sm p-1.5">
                    <div className={`led ${a.severity === 'alert' ? 'led-crit' : 'led-warn'}`} />
                    <span className="text-text-dim font-data text-[10px] w-14 flex-shrink-0">{a.type}</span>
                    <span className="text-text-primary truncate">{a.vessel}</span>
                    <span className="text-text-dim font-data ml-auto flex-shrink-0">{a.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] px-2 py-0.5 rounded-sm transition-colors uppercase tracking-wider font-semibold ${
        active ? 'bg-accent/15 text-accent' : 'text-text-dim hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}

function MiniCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-1 rounded-sm border border-border-dim p-3">
      <h4 className="label-caps mb-1.5">{title}</h4>
      {children}
    </div>
  );
}

function TrendCard({ label, current, avg, unit }: { label: string; current: number; avg: number; unit?: string }) {
  const diff = avg > 0 ? ((current - avg) / avg) * 100 : 0;
  const isUp = diff > 5;
  const isDown = diff < -5;
  return (
    <div className="bg-surface-1 rounded-sm border border-border-dim p-3">
      <div className="label-caps mb-0.5">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-bold text-white font-data">{current}{unit ? ` ${unit}` : ''}</span>
        <span className={`flex items-center gap-0.5 text-[11px] font-data ${isUp ? 'text-status-nominal' : isDown ? 'text-status-crit' : 'text-text-dim'}`}>
          {isUp ? <TrendingUp size={11} /> : isDown ? <TrendingDown size={11} /> : <Minus size={11} />}
          {Math.abs(Math.round(diff))}%
        </span>
      </div>
      <div className="text-[10px] text-text-dim font-data">avg {avg}{unit ? ` ${unit}` : ''}</div>
    </div>
  );
}
