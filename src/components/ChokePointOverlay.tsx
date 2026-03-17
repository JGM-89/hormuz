import { useStore } from '../store';
import { getCongestionLevel } from '../utils/geo';
import Widget from './Widget';

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

  // Speed anomaly detection — flag only unrealistically fast vessels (>25 kn is unusual for this strait)
  const anomalies = [...vessels.values()].filter(
    (v) => v.speed > 25,
  );

  return (
    <div className="space-y-2" role="region" aria-label="Chokepoint status">
      {/* Congestion Card */}
      <Widget>
        <div className="flex items-center gap-2 mb-2">
          <div
            className="led"
            style={{
              background: congestion.color,
              boxShadow: `0 0 6px ${congestion.color}, 0 0 12px ${congestion.color}40`,
            }}
            aria-hidden="true"
          />
          <span className="label-caps" style={{ color: congestion.color }}>
            Congestion: {congestion.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-surface-1 rounded-sm p-1.5" title="Vessels transiting eastbound in the last hour">
            <span className="label-caps">Eastbound</span>
            <div className="text-accent font-bold text-sm font-data">{eastbound}</div>
          </div>
          <div className="bg-surface-1 rounded-sm p-1.5" title="Vessels transiting westbound in the last hour">
            <span className="label-caps">Westbound</span>
            <div className="text-status-warn font-bold text-sm font-data">{westbound}</div>
          </div>
        </div>
      </Widget>

      {/* Anomaly Alerts */}
      {anomalies.length > 0 && (
        <Widget
          severity="warn"
          role="alert"
          aria-label={`${anomalies.length} speed anomalies detected`}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1L1 14h14L8 1z" stroke="#ffab00" strokeWidth="1.5" fill="none" />
              <path d="M8 6v4M8 12v.5" stroke="#ffab00" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] font-semibold text-status-warn uppercase tracking-widest">
              Speed Anomalies ({anomalies.length})
            </span>
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto" role="list">
            {anomalies.slice(0, 5).map((v) => (
              <div key={v.mmsi} className="text-[11px] text-text-primary flex justify-between" role="listitem">
                <span className="truncate max-w-[140px]">{v.name}</span>
                <span className="font-data text-status-warn">
                  {v.speed.toFixed(1)} kn
                </span>
              </div>
            ))}
          </div>
        </Widget>
      )}
    </div>
  );
}
