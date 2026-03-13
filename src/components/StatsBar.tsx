import { useStore } from '../store';
import { getCongestionLevel } from '../utils/geo';

export default function StatsBar() {
  const stats = useStore((s) => s.stats);
  const connected = useStore((s) => s.connected);
  const congestion = getCongestionLevel(stats.totalVessels);

  // Rough daily oil volume estimate (avg VLCC ~2M barrels, ~30 tankers/day through Hormuz)
  const estimatedDailyMbpd = (stats.totalVessels * 0.6).toFixed(1);

  return (
    <div className="flex items-center gap-6 px-6 py-3 bg-slate-900/80 border-b border-slate-700/50 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}
        />
        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
          {connected ? 'Live' : 'Disconnected'}
        </span>
      </div>

      <div className="h-4 w-px bg-slate-700" />

      <StatItem label="Active Tankers" value={stats.totalVessels} />
      <StatItem label="In Transit" value={stats.inTransit} accent="cyan" />
      <StatItem label="Anchored" value={stats.anchored} accent="slate" />
      <StatItem label="Avg Speed" value={`${stats.avgSpeed} kn`} />
      <StatItem label="Est. Daily Volume" value={`~${estimatedDailyMbpd} MBbl`} accent="amber" />

      <div className="h-4 w-px bg-slate-700" />

      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: congestion.color }}
        />
        <span className="text-xs text-slate-400">Congestion:</span>
        <span className="text-xs font-semibold" style={{ color: congestion.color }}>
          {congestion.label}
        </span>
      </div>

      <div className="ml-auto text-xs text-slate-500 font-mono">
        {stats.messageCount.toLocaleString()} msgs
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  const colorClass =
    accent === 'cyan'
      ? 'text-cyan-400'
      : accent === 'amber'
        ? 'text-amber-400'
        : accent === 'slate'
          ? 'text-slate-400'
          : 'text-white';

  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${colorClass}`}>{value}</span>
    </div>
  );
}
