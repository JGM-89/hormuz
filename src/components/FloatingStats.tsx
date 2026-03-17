import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { getCongestionLevel } from '../utils/geo';
import { Activity, Clock } from 'lucide-react';

export default function FloatingStats() {
  const stats = useStore((s) => s.stats);
  const aisHealth = useStore((s) => s.aisHealth);
  const connected = useStore((s) => s.connected);
  const congestion = getCongestionLevel(stats.totalVessels);
  const [utc, setUtc] = useState(() => new Date().toISOString().slice(11, 19));

  useEffect(() => {
    const id = setInterval(() => setUtc(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(id);
  }, []);

  const statusConfig: Record<string, { ledClass: string; textColor: string; label: string }> = {
    live: { ledClass: 'led-live', textColor: 'text-status-nominal', label: 'AIS LIVE' },
    outage: { ledClass: 'led-crit', textColor: 'text-status-crit', label: 'AIS OUTAGE' },
    waiting: { ledClass: 'led-warn', textColor: 'text-status-warn', label: 'WAITING' },
    connecting: { ledClass: 'led-warn', textColor: 'text-status-warn', label: 'CONNECTING' },
  };

  const status = aisHealth ? statusConfig[aisHealth.status] : null;

  return (
    <div
      className="flex items-center gap-3 bg-surface-0 border border-border rounded-sm px-3 py-1.5"
      role="status"
      aria-label={`Dashboard status: ${stats.totalVessels} vessels tracked`}
    >
      {/* UTC Clock */}
      <div className="flex items-center gap-1.5" title="UTC Time">
        <Clock size={12} className="text-text-dim" />
        <span className="text-[11px] font-data text-text-dim tracking-wider">{utc}Z</span>
      </div>

      <Divider />

      {/* AIS Status */}
      {status ? (
        <div
          className="flex items-center gap-1.5"
          title={
            aisHealth?.lastMessage
              ? `Last message: ${Math.round((Date.now() - aisHealth.lastMessage) / 1000)}s ago`
              : 'No AIS messages received'
          }
          aria-label={`AIS status: ${status.label}`}
        >
          <div className={`led ${status.ledClass}`} />
          <span className={`text-[11px] font-semibold uppercase tracking-widest ${status.textColor}`}>
            {status.label}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5" aria-label={`Connection: ${connected ? 'Connected' : 'Offline'}`}>
          <div className={`led ${connected ? 'led-live' : 'led-crit'}`} />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-text-dim">
            {connected ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>
      )}

      <Divider />

      {/* Hero metric: vessel count */}
      <div className="flex items-baseline gap-1" title="Total vessels currently tracked in the strait">
        <Activity size={12} className="text-accent" />
        <span className="text-lg font-bold font-data text-white">{stats.totalVessels}</span>
        <span className="text-[11px] text-text-dim uppercase tracking-widest">Vessels</span>
      </div>

      <Divider />

      <Stat value={stats.inTransit} label="Transit" accent title="Vessels currently moving through the strait" />
      <Stat value={`${stats.avgSpeed}`} label="kn avg" title="Average speed of moving vessels" />

      <Divider />

      <div className="flex items-center gap-1.5" title={`Congestion level: ${congestion.label}`}>
        <div
          className="led"
          style={{
            background: congestion.color,
            boxShadow: `0 0 6px ${congestion.color}, 0 0 12px ${congestion.color}40`,
          }}
        />
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: congestion.color }}>
          {congestion.label}
        </span>
      </div>
    </div>
  );
}

function Stat({ value, label, accent, title }: { value: string | number; label: string; accent?: boolean; title?: string }) {
  return (
    <div className="flex items-baseline gap-1" title={title}>
      <span className="text-base font-bold font-data" style={accent ? { color: '#00b4d8' } : { color: '#fff' }}>{value}</span>
      <span className="text-[11px] uppercase tracking-widest" style={{ color: '#7a8ba3' }}>{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-5 w-px bg-border" aria-hidden="true" />;
}
