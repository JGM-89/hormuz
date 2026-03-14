import { useStore } from '../store';
import { Ship } from 'lucide-react';

export default function LogoPill() {
  const aisHealth = useStore((s) => s.aisHealth);
  const connected = useStore((s) => s.connected);

  const isLive = aisHealth ? aisHealth.status === 'live' : connected;
  const statusLabel = aisHealth?.status === 'outage' ? 'Outage' : isLive ? 'Live' : 'Offline';

  return (
    <div className="flex items-center gap-3" role="banner" aria-label={`Hormuz Command — ${statusLabel}`}>
      <div className="flex items-center gap-2">
        <Ship size={20} className="text-accent" />
        <span className="text-sm font-bold tracking-tight">
          <span className="text-text-primary">HORMUZ</span>
          <span className="text-accent">COMMAND</span>
        </span>
      </div>
      <div className="h-5 w-px bg-border" aria-hidden="true" />
      <div className="flex items-center gap-1.5">
        <div
          className={`led ${isLive ? 'led-live' : 'led-crit'} ${isLive ? 'animate-pulse-radar' : ''}`}
          aria-hidden="true"
        />
        <span className={`text-[11px] font-semibold uppercase tracking-widest ${isLive ? 'text-status-nominal' : 'text-status-crit'}`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
