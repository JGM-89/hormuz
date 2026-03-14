import { useStore } from '../store';
import Widget from './Widget';

export default function OutageOverlay() {
  const vessels = useStore((s) => s.vessels);
  const aisHealth = useStore((s) => s.aisHealth);

  if (vessels.size > 0) return null;

  const isOutage = aisHealth?.status === 'outage';

  return (
    <Widget role="alert" aria-live="polite">
      <div className="flex items-center gap-3">
        {/* Pulsing dot */}
        <div className="relative flex-shrink-0" aria-hidden="true">
          <div className={`w-2.5 h-2.5 rounded-full ${isOutage ? 'bg-red-400' : 'bg-amber-400'}`} />
          <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping ${isOutage ? 'bg-red-400' : 'bg-amber-400'}`} />
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-white whitespace-nowrap">
            {isOutage ? 'AIS Outage' : 'Waiting for AIS data'}
          </span>
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {isOutage ? 'Feed down \u2014 auto-reconnecting' : 'Will populate when data arrives'}
          </span>
        </div>

        {aisHealth && (
          <div className="text-xs text-slate-500 border-l border-slate-700/50 pl-3 ml-1 flex gap-3 whitespace-nowrap">
            <span>Uptime: {aisHealth.serverUptime > 3600 ? `${Math.round(aisHealth.serverUptime / 3600)}h` : `${Math.round(aisHealth.serverUptime / 60)}m`}</span>
            {aisHealth.reconnects > 0 && <span>Reconnects: {aisHealth.reconnects}</span>}
          </div>
        )}
      </div>
    </Widget>
  );
}
