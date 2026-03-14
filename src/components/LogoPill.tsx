import { useStore } from '../store';

export default function LogoPill() {
  const aisHealth = useStore((s) => s.aisHealth);
  const connected = useStore((s) => s.connected);

  const isLive = aisHealth ? aisHealth.status === 'live' : connected;

  return (
    <div className="flex items-center gap-2.5 bg-slate-900/80 backdrop-blur-md rounded-full px-4 py-2 border border-slate-700/50 shadow-xl">
      <div className="text-sm font-bold tracking-tight">
        <span className="text-cyan-400">HORMUZ</span>
        <span className="text-slate-400 font-light ml-1">TRACKER</span>
      </div>
      <div className="h-3 w-px bg-slate-700" />
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
        <span className={`text-[10px] font-medium uppercase tracking-wider ${isLive ? 'text-emerald-400' : 'text-red-400'}`}>
          {aisHealth?.status === 'outage' ? 'Outage' : isLive ? 'Live' : 'Offline'}
        </span>
      </div>
    </div>
  );
}
