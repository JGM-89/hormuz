import { useStore } from '../store';
import Widget from './Widget';

export default function LogoPill() {
  const aisHealth = useStore((s) => s.aisHealth);
  const connected = useStore((s) => s.connected);

  const isLive = aisHealth ? aisHealth.status === 'live' : connected;
  const statusLabel = aisHealth?.status === 'outage' ? 'Outage' : isLive ? 'Live' : 'Offline';

  return (
    <Widget variant="pill" severity="none" role="banner" aria-label={`Hormuz Tracker — ${statusLabel}`}>
      <div className="flex items-center gap-2.5">
        <div className="text-xs font-bold">
          <span className="text-accent tracking-widest">HORMUZ</span>
          <span className="text-text-dim tracking-widest ml-1">TRACKER</span>
        </div>
        <div className="h-4 w-px bg-border" aria-hidden="true" />
        <div className="flex items-center gap-1.5">
          <div
            className={`led ${isLive ? 'led-live' : 'led-crit'} ${isLive ? 'animate-pulse-radar' : ''}`}
            aria-hidden="true"
          />
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${isLive ? 'text-status-nominal' : 'text-status-crit'}`}>
            {statusLabel}
          </span>
        </div>
      </div>
    </Widget>
  );
}
