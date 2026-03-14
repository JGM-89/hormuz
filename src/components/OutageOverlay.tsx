import { useStore } from '../store';
import Widget from './Widget';

export default function OutageOverlay() {
  const vessels = useStore((s) => s.vessels);
  const aisHealth = useStore((s) => s.aisHealth);

  if (vessels.size > 0) return null;

  const isOutage = aisHealth?.status === 'outage';

  return (
    <Widget severity={isOutage ? 'crit' : 'warn'} role="alert" aria-live="polite">
      <div className="flex items-center gap-3">
        <div
          className={`led ${isOutage ? 'led-crit animate-blink' : 'led-warn'}`}
          aria-hidden="true"
        />

        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold text-white uppercase tracking-wider whitespace-nowrap">
            {isOutage ? 'AIS Outage' : 'Waiting for AIS data'}
          </span>
          <span className="text-[10px] text-text-dim whitespace-nowrap">
            {isOutage ? 'Feed down \u2014 auto-reconnecting' : 'Will populate when data arrives'}
          </span>
        </div>

        {aisHealth && (
          <div className="text-[10px] text-text-dim font-data border-l border-border pl-3 ml-1 flex gap-3 whitespace-nowrap">
            <span>UP {aisHealth.serverUptime > 3600 ? `${Math.round(aisHealth.serverUptime / 3600)}h` : `${Math.round(aisHealth.serverUptime / 60)}m`}</span>
            {aisHealth.reconnects > 0 && <span>RC {aisHealth.reconnects}</span>}
          </div>
        )}
      </div>
    </Widget>
  );
}
