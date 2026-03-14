import { useStore } from '../store';
import { getCongestionLevel, LANDMARKS } from '../utils/geo';

export default function ChokePointOverlay() {
  const stats = useStore((s) => s.stats);
  const transitHistory = useStore((s) => s.transitHistory);
  const congestion = getCongestionLevel(stats.totalVessels);

  // Recent transits (last hour)
  const recentTransits = transitHistory.filter(
    (t) => Date.now() - t.timestamp < 3600000,
  );
  const eastbound = recentTransits.filter((t) => t.direction === 'eastbound').length;
  const westbound = recentTransits.filter((t) => t.direction === 'westbound').length;

  // Speed anomaly detection
  const vessels = useStore((s) => s.vessels);
  const anomalies = [...vessels.values()].filter(
    (v) => v.speed > 0.5 && (v.speed < 3 || v.speed > 16),
  );

  return (
    <div className="absolute bottom-4 left-4 z-10 space-y-2 max-w-[240px]">
      {/* Congestion Card */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/50 p-3 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: congestion.color }}
          />
          <span className="text-xs font-semibold text-slate-200">
            Congestion: {congestion.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="bg-slate-800/50 rounded p-1.5">
            <span className="text-slate-500">Eastbound (1h)</span>
            <div className="text-cyan-400 font-bold text-sm">{eastbound}</div>
          </div>
          <div className="bg-slate-800/50 rounded p-1.5">
            <span className="text-slate-500">Westbound (1h)</span>
            <div className="text-amber-400 font-bold text-sm">{westbound}</div>
          </div>
        </div>
      </div>

      {/* Anomaly Alerts */}
      {anomalies.length > 0 && (
        <div className="bg-slate-900/90 backdrop-blur-md rounded-lg border border-amber-500/30 p-3 shadow-xl">
          <div className="flex items-center gap-1.5 mb-1.5">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1L1 14h14L8 1z"
                stroke="#f59e0b"
                strokeWidth="1.5"
                fill="none"
              />
              <path d="M8 6v4M8 12v.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
              Speed Anomalies ({anomalies.length})
            </span>
          </div>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {anomalies.slice(0, 5).map((v) => (
              <div
                key={v.mmsi}
                className="text-[10px] text-slate-300 flex justify-between"
              >
                <span className="truncate max-w-[140px]">{v.name}</span>
                <span className={v.speed < 3 ? 'text-red-400' : 'text-amber-400'}>
                  {v.speed.toFixed(1)} kn
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Landmarks */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/50 p-2.5 shadow-xl">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
          Key Landmarks
        </span>
        <div className="mt-1 space-y-0.5">
          {LANDMARKS.slice(0, 4).map((lm) => (
            <div key={lm.name} className="text-[10px] text-slate-400">
              {lm.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
