import { useStore } from '../store';

export default function OutageOverlay() {
  const vessels = useStore((s) => s.vessels);
  const aisHealth = useStore((s) => s.aisHealth);

  if (vessels.size > 0) return null;

  const isOutage = aisHealth?.status === 'outage';

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10">
      <div className="bg-slate-900/80 backdrop-blur-md rounded-lg border border-slate-700/50 px-4 py-2.5 shadow-xl flex items-center gap-3">
        {/* Pulsing dot */}
        <div className="relative flex-shrink-0">
          <div className={`w-2.5 h-2.5 rounded-full ${isOutage ? 'bg-red-400' : 'bg-amber-400'}`} />
          <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping ${isOutage ? 'bg-red-400' : 'bg-amber-400'}`} />
        </div>

        <div>
          <span className="text-xs font-semibold text-white">
            {isOutage ? 'AIS Outage' : 'Waiting for AIS data'}
          </span>
          <span className="text-[11px] text-slate-400 ml-2">
            {isOutage ? 'Feed down \u2014 auto-reconnecting' : 'Will populate when data arrives'}
          </span>
        </div>

        {aisHealth && (
          <div className="text-[10px] text-slate-500 border-l border-slate-700/50 pl-3 ml-1 flex gap-3">
            <span>Uptime: {aisHealth.serverUptime > 3600 ? `${Math.round(aisHealth.serverUptime / 3600)}h` : `${Math.round(aisHealth.serverUptime / 60)}m`}</span>
            {aisHealth.reconnects > 0 && <span>Reconnects: {aisHealth.reconnects}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
