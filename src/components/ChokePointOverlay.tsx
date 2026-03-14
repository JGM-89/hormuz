import { useStore } from '../store';
import { getCongestionLevel } from '../utils/geo';

export default function ChokePointOverlay() {
  const stats = useStore((s) => s.stats);
  const transitHistory = useStore((s) => s.transitHistory);
  const vessels = useStore((s) => s.vessels);
  const congestion = getCongestionLevel(stats.totalVessels);

  // Don't render if no data yet
  if (vessels.size === 0) return null;

  // Recent transits (last hour)
  const recentTransits = transitHistory.filter(
    (t) => Date.now() - t.timestamp < 3600000,
  );
  const eastbound = recentTransits.filter((t) => t.direction === 'eastbound').length;
  const westbound = recentTransits.filter((t) => t.direction === 'westbound').length;

  // Speed anomaly detection
  const anomalies = [...vessels.values()].filter(
    (v) => v.speed > 0.5 && (v.speed < 3 || v.speed > 16),
  );

  return (
    <div className="space-y-2" role="region" aria-label="Chokepoint status">
      {/* Congestion Card */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/50 p-3 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: congestion.color }}
            aria-hidden="true"
          />
          <span className="text-xs font-semibold text-slate-200">
            Congestion: {congestion.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-800/50 rounded p-2" title="Vessels transiting eastbound in the last hour">
            <span className="text-xs text-slate-400">Eastbound</span>
            <div className="text-cyan-400 font-bold text-sm tabular-nums">{eastbound}</div>
          </div>
          <div className="bg-slate-800/50 rounded p-2" title="Vessels transiting westbound in the last hour">
            <span className="text-xs text-slate-400">Westbound</span>
            <div className="text-amber-400 font-bold text-sm tabular-nums">{westbound}</div>
          </div>
        </div>
      </div>

      {/* Anomaly Alerts */}
      {anomalies.length > 0 && (
        <div
          className="bg-slate-900/90 backdrop-blur-md rounded-lg border border-amber-500/30 p-3 shadow-xl"
          role="alert"
          aria-label={`${anomalies.length} speed anomalies detected`}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 1L1 14h14L8 1z"
                stroke="#f59e0b"
                strokeWidth="1.5"
                fill="none"
              />
              <path d="M8 6v4M8 12v.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Speed Anomalies ({anomalies.length})
            </span>
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto" role="list">
            {anomalies.slice(0, 5).map((v) => (
              <div
                key={v.mmsi}
                className="text-xs text-slate-300 flex justify-between"
                role="listitem"
              >
                <span className="truncate max-w-[140px]">{v.name}</span>
                <span className={`tabular-nums ${v.speed < 3 ? 'text-red-400' : 'text-amber-400'}`}>
                  {v.speed.toFixed(1)} kn
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
