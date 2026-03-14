import { useStore } from '../store';

export default function LogoPill() {
  const aisHealth = useStore((s) => s.aisHealth);
  const connected = useStore((s) => s.connected);

  const isLive = aisHealth ? aisHealth.status === 'live' : connected;
  const statusLabel = aisHealth?.status === 'outage' ? 'Outage' : isLive ? 'Live' : 'Offline';

  return (
    <div
      className="flex items-center gap-2.5 bg-slate-900/80 backdrop-blur-md rounded-full px-4 py-2.5 border border-slate-700/50 shadow-xl"
      role="banner"
      aria-label={`Hormuz Tracker — ${statusLabel}`}
    >
      <div className="text-sm font-bold tracking-tight">
        <span className="text-cyan-400">HORMUZ</span>
        <span className="text-slate-400 font-light ml-1">TRACKER</span>
      </div>
      <div className="h-4 w-px bg-slate-700" aria-hidden="true" />
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}
          aria-hidden="true"
        />
        <span className={`text-xs font-medium uppercase tracking-wider ${isLive ? 'text-emerald-400' : 'text-red-400'}`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
