import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { useStore } from '../store';

const COLORS = ['#22d3ee', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 6,
  fontSize: 11,
  color: '#e2e8f0',
};

export default function TrafficChart() {
  const vessels = useStore((s) => s.vessels);
  const transitHistory = useStore((s) => s.transitHistory);
  const historicalData = useStore((s) => s.historicalData);

  // Speed distribution
  const speedData = useMemo(() => {
    const buckets = [
      { range: '0-2', count: 0 },
      { range: '2-6', count: 0 },
      { range: '6-10', count: 0 },
      { range: '10-14', count: 0 },
      { range: '14+', count: 0 },
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

  // Direction breakdown
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

  // Transit timeline (last 24h by hour)
  const transitTimeline = useMemo(() => {
    const now = Date.now();
    const hours: { hour: string; count: number }[] = [];
    for (let i = 23; i >= 0; i--) {
      const start = now - (i + 1) * 3600000;
      const end = now - i * 3600000;
      const count = transitHistory.filter(
        (t) => t.timestamp >= start && t.timestamp < end,
      ).length;
      const d = new Date(end);
      hours.push({
        hour: `${d.getHours().toString().padStart(2, '0')}:00`,
        count,
      });
    }
    return hours;
  }, [transitHistory]);

  // Historical daily transit chart
  const dailyTransitData = useMemo(() => {
    if (!historicalData?.transitCounts) return [];
    return historicalData.transitCounts.map((d) => ({
      date: new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      eastbound: d.eastbound,
      westbound: d.westbound,
      total: d.total,
    }));
  }, [historicalData]);

  // Historical daily vessel/speed chart
  const dailyStatsData = useMemo(() => {
    if (!historicalData?.dailyStats) return [];
    return historicalData.dailyStats.map((d) => ({
      date: new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      peakVessels: d.peak_vessels,
      avgSpeed: d.avg_speed,
    }));
  }, [historicalData]);

  return (
    <div className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        Live Analytics
      </h2>

      {/* Speed Distribution */}
      <ChartCard title="Speed Distribution (knots)">
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={speedData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <XAxis dataKey="range" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill="#22d3ee" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Direction Breakdown */}
      <ChartCard title="Traffic Direction">
        <div className="flex items-center">
          <ResponsiveContainer width="50%" height={90}>
            <PieChart>
              <Pie data={directionData} cx="50%" cy="50%" innerRadius={25} outerRadius={38} paddingAngle={3} dataKey="value">
                {directionData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-1.5">
            {directionData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-[10px] text-slate-400">
                  {d.name}: <span className="text-slate-200 font-medium">{d.value}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </ChartCard>

      {/* Transit Timeline */}
      <ChartCard title="Strait Transits (24h)">
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={transitTimeline} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <XAxis dataKey="hour" tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} interval={5} />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="count" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Historical Section */}
      {historicalData && (
        <>
          <div className="mt-2 pt-2 border-t border-slate-700/50">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Historical Trends (30 days)
            </h2>
          </div>

          {/* Daily Transit Counts */}
          {dailyTransitData.length > 0 && (
            <ChartCard title="Daily Transits">
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={dailyTransitData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 7, fill: '#64748b' }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <Bar dataKey="eastbound" fill="#22d3ee" radius={[2, 2, 0, 0]} stackId="a" />
                  <Bar dataKey="westbound" fill="#f59e0b" radius={[2, 2, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Daily Peak Vessels & Avg Speed */}
          {dailyStatsData.length > 0 && (
            <ChartCard title="Daily Peak Vessels & Avg Speed">
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={dailyStatsData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 7, fill: '#64748b' }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <Line type="monotone" dataKey="peakVessels" stroke="#10b981" strokeWidth={2} dot={false} name="Peak Vessels" />
                  <Line type="monotone" dataKey="avgSpeed" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Avg Speed (kn)" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Top Vessels */}
          {historicalData.topVessels?.length > 0 && (
            <ChartCard title="Most Frequent Vessels (30d)">
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {historicalData.topVessels.slice(0, 10).map((v, i) => (
                  <div key={v.mmsi} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 w-4">{i + 1}.</span>
                      <span className="text-slate-200 truncate max-w-[120px]">{v.name}</span>
                      <span className="text-slate-500">{v.flag}</span>
                    </div>
                    <span className="text-cyan-400 font-mono font-medium">{v.transit_count}x</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}

          {/* DB Stats */}
          {historicalData.dbStats && (
            <ChartCard title="Database">
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="text-slate-500">Positions recorded</div>
                <div className="text-slate-300 text-right font-mono">{historicalData.dbStats.positions.toLocaleString()}</div>
                <div className="text-slate-500">Transits detected</div>
                <div className="text-slate-300 text-right font-mono">{historicalData.dbStats.transits.toLocaleString()}</div>
                <div className="text-slate-500">Collecting since</div>
                <div className="text-slate-300 text-right font-mono">
                  {historicalData.dbStats.oldestRecord
                    ? new Date(historicalData.dbStats.oldestRecord).toLocaleDateString()
                    : 'N/A'}
                </div>
              </div>
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/30 rounded-lg border border-slate-700/30 p-2.5">
      <h3 className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1.5">
        {title}
      </h3>
      {children}
    </div>
  );
}
