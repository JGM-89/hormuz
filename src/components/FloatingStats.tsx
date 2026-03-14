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
    <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-md rounded-full px-5 py-2 border border-slate-700/50 shadow-xl">
      {/* AIS Status */}
      {status ? (
        <div className="flex items-center gap-1.5" title={
          aisHealth?.lastMessage
            ? `Last message: ${Math.round((Date.now() - aisHealth.lastMessage) / 1000)}s ago`
            : 'No AIS messages received'
        }>
          <div className={`w-1.5 h-1.5 rounded-full ${status.color} ${aisHealth?.status === 'live' ? 'animate-pulse' : ''}`} />
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${status.textColor}`}>
            {status.label}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {connected ? 'Connected' : 'Offline'}
          </span>
        </div>
      )}

      <Divider />

      <Stat value={stats.totalVessels} label="Tankers" />
      <Stat value={stats.inTransit} label="Transit" accent="cyan" />
      <Stat value={`${stats.avgSpeed}`} label="kn avg" />

      <Divider />

      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: congestion.color }} />
        <span className="text-[10px] font-semibold" style={{ color: congestion.color }}>
          {congestion.label}
        </span>
      </div>
    </div>
  );
}

function Stat({ value, label, accent }: { value: string | number; label: string; accent?: string }) {
  const color = accent === 'cyan' ? 'text-cyan-400' : 'text-white';
  return (
    <div className="flex items-baseline gap-1">
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] text-slate-500">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-3 w-px bg-slate-700" />;
}
