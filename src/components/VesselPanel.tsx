import { useStore } from '../store';
import { getNavStatusLabel, getSpeedColor, formatSpeed, timeAgo } from '../utils/ais';

export default function VesselPanel() {
  const selectedVessel = useStore((s) => s.selectedVessel);
  const vessels = useStore((s) => s.vessels);
  const setSelectedVessel = useStore((s) => s.setSelectedVessel);

  if (!selectedVessel) return null;
  const vessel = vessels.get(selectedVessel);
  if (!vessel) return null;

  const speedColor = getSpeedColor(vessel.speed);

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-slate-900/95 backdrop-blur-md border-l border-slate-700/50 z-20 overflow-y-auto shadow-2xl animate-slide-in">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-700/50 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-white leading-tight">{vessel.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">MMSI: {vessel.mmsi}</p>
          </div>
          <button
            onClick={() => setSelectedVessel(null)}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Type & Status */}
        <Section title="Vessel Info">
          <InfoRow label="Type" value={vessel.shipTypeLabel} />
          <InfoRow label="Flag" value={vessel.flag || 'Unknown'} />
          <InfoRow label="Status" value={getNavStatusLabel(vessel.navStatus)} />
          <InfoRow label="Last Update" value={timeAgo(vessel.lastUpdate)} />
        </Section>

        {/* Navigation */}
        <Section title="Navigation">
          <div className="grid grid-cols-2 gap-3">
            <GaugeCard label="Speed" value={formatSpeed(vessel.speed)} color={speedColor} />
            <GaugeCard label="Course" value={`${vessel.course.toFixed(0)}°`} color="#22d3ee" />
            <GaugeCard label="Heading" value={`${vessel.heading.toFixed(0)}°`} color="#8b5cf6" />
            <GaugeCard
              label="Position"
              value={`${vessel.lat.toFixed(3)}°`}
              subValue={`${vessel.lon.toFixed(3)}°`}
              color="#64748b"
            />
          </div>
        </Section>

        {/* Trail */}
        {vessel.trail.length > 1 && (
          <Section title={`Track History (${vessel.trail.length} pts)`}>
            <div className="h-24 relative bg-slate-800/50 rounded-lg overflow-hidden">
              <TrailMiniMap trail={vessel.trail} />
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-800">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs text-slate-200 font-medium">{value}</span>
    </div>
  );
}

function GaugeCard({
  label,
  value,
  subValue,
  color,
}: {
  label: string;
  value: string;
  subValue?: string;
  color: string;
}) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/30">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-bold mt-0.5" style={{ color }}>
        {value}
      </div>
      {subValue && (
        <div className="text-xs text-slate-400 -mt-0.5">{subValue}</div>
      )}
    </div>
  );
}

function TrailMiniMap({ trail }: { trail: { lat: number; lon: number }[] }) {
  if (trail.length < 2) return null;

  const lats = trail.map((p) => p.lat);
  const lons = trail.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const padding = 10;
  const w = 280;
  const h = 96;

  const rangeX = maxLon - minLon || 0.01;
  const rangeY = maxLat - minLat || 0.01;

  const points = trail
    .map((p) => {
      const x = padding + ((p.lon - minLon) / rangeX) * (w - 2 * padding);
      const y = h - padding - ((p.lat - minLat) / rangeY) * (h - 2 * padding);
      return `${x},${y}`;
    })
    .join(' ');

  const last = trail[trail.length - 1];
  const lastX = padding + ((last.lon - minLon) / rangeX) * (w - 2 * padding);
  const lastY = h - padding - ((last.lat - minLat) / rangeY) * (h - 2 * padding);

  return (
    <svg width={w} height={h} className="w-full h-full">
      <polyline
        points={points}
        fill="none"
        stroke="#22d3ee"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
      <circle cx={lastX} cy={lastY} r="4" fill="#22d3ee" />
    </svg>
  );
}
