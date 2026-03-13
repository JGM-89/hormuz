import { useStore } from '../store';
import { getCongestionLevel } from '../utils/geo';

function AisStatusOrConnection({ connected }: { connected: boolean }) {
  const aisHealth = useStore((s) => s.aisHealth);

  // No health data yet — show simple connection status
  if (!aisHealth) {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    );
  }

  const statusConfig = {
    live: { color: 'bg-emerald-400', text: 'AIS Live', textColor: 'text-emerald-400' },
    outage: { color: 'bg-red-500', text: 'AIS Outage', textColor: 'text-red-400' },
    waiting: { color: 'bg-amber-400', text: 'AIS Waiting', textColor: 'text-amber-400' },
    connecting: { color: 'bg-amber-400', text: 'AIS Connecting', textColor: 'text-amber-400' },
  };

  const cfg = statusConfig[aisHealth.status];
  const ago = aisHealth.lastMessage
    ? Math.round((Date.now() - aisHealth.lastMessage) / 1000)
    : null;

  return (
    <div className="flex items-center gap-2" title={
      ago !== null
        ? `Last AIS message: ${ago}s ago | Reconnects: ${aisHealth.reconnects} | Server uptime: ${aisHealth.serverUptime}s`
        : `No AIS messages received | Reconnects: ${aisHealth.reconnects}`
    }>
      <div className={`w-2 h-2 rounded-full ${cfg.color} ${aisHealth.status === 'live' ? 'animate-pulse' : ''}`} />
      <span className={`text-xs font-medium ${cfg.textColor}`}>{cfg.text}</span>
      {aisHealth.status === 'outage' && (
        <span className="text-[10px] text-red-400/70">
          (no data {ago !== null ? `${ago > 60 ? Math.round(ago / 60) + 'm' : ago + 's'}` : ''})
        </span>
      )}
    </div>
  );
}

export default function StatsBar() {
  const stats = useStore((s) => s.stats);
  const connected = useStore((s) => s.connected);
  const congestion = getCongestionLevel(stats.totalVessels);

  // Rough daily oil volume estimate (avg VLCC ~2M barrels, ~30 tankers/day through Hormuz)
  const estimatedDailyMbpd = (stats.totalVessels * 0.6).toFixed(1);

  return (
    <div className="flex items-center gap-6 px-6 py-3 bg-slate-900/80 border-b border-slate-700/50 backdrop-blur-sm">
      <AisStatusOrConnection connected={connected} />

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
