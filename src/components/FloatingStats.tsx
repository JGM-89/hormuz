import { useStore } from '../store';
import { getCongestionLevel } from '../utils/geo';

export default function FloatingStats() {
  const stats = useStore((s) => s.stats);
  const aisHealth = useStore((s) => s.aisHealth);
  const connected = useStore((s) => s.connected);
  const congestion = getCongestionLevel(stats.totalVessels);

  const statusConfig: Record<string, { color: string; textColor: string; label: string }> = {
    live: { color: 'bg-emerald-400', textColor: 'text-emerald-400', label: 'AIS Live' },
    outage: { color: 'bg-red-500', textColor: 'text-red-400', label: 'AIS Outage' },
    waiting: { color: 'bg-amber-400', textColor: 'text-amber-400', label: 'Waiting' },
    connecting: { color: 'bg-amber-400', textColor: 'text-amber-400', label: 'Connecting' },
  };

  const status = aisHealth ? statusConfig[aisHealth.status] : null;

  return (
    <div
      className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-md rounded-full px-5 py-2.5 border border-slate-700/50 shadow-xl"
      role="status"
      aria-label={`Dashboard status: ${stats.totalVessels} vessels tracked`}
    >
      {/* AIS Status */}
      {status ? (
        <div
          className="flex items-center gap-1.5"
          title={
            aisHealth?.lastMessage
              ? `Last message: ${Math.round((Date.now() - aisHealth.lastMessage) / 1000)}s ago`
              : 'No AIS messages received'
          }
          aria-label={`AIS status: ${status.label}`}
        >
          <div className={`w-2 h-2 rounded-full ${status.color} ${aisHealth?.status === 'live' ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-semibold uppercase tracking-wider ${status.textColor}`}>
            {status.label}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5" aria-label={`Connection: ${connected ? 'Connected' : 'Offline'}`}>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {connected ? 'Connected' : 'Offline'}
          </span>
        </div>
      )}

      <Divider />

      {/* Hero metric: vessel count */}
      <div className="flex items-baseline gap-1.5" title="Total vessels currently tracked in the strait">
        <span className="text-lg font-bold tabular-nums text-white">{stats.totalVessels}</span>
        <span className="text-xs text-slate-400">Vessels</span>
      </div>

      <Divider />

      <Stat value={stats.inTransit} label="Transit" accent="cyan" title="Vessels currently moving through the strait" />
      <Stat value={`${stats.avgSpeed}`} label="kn avg" title="Average speed of moving vessels" />

      <Divider />

      <div className="flex items-center gap-1.5" title={`Congestion level: ${congestion.label}`}>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: congestion.color }} />
        <span className="text-xs font-semibold" style={{ color: congestion.color }}>
          {congestion.label}
        </span>
      </div>
    </div>
  );
}

function Stat({ value, label, accent, title }: { value: string | number; label: string; accent?: string; title?: string }) {
  const color = accent === 'cyan' ? 'text-cyan-400' : 'text-white';
  return (
    <div className="flex items-baseline gap-1" title={title}>
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-4 w-px bg-slate-700" aria-hidden="true" />;
}
