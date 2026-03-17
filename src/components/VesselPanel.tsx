import { useMemo, useEffect } from 'react';
import { useStore } from '../store';
import { getNavStatusLabel, getSpeedColor, formatSpeed, timeAgo } from '../utils/ais';
import { getTransitProgress, haversineNm } from '../utils/geo';
import SpeedSparkline from './SpeedSparkline';

export default function VesselPanel() {
  const selectedVessel = useStore((s) => s.selectedVessel);
  const vessels = useStore((s) => s.vessels);
  const setSelectedVessel = useStore((s) => s.setSelectedVessel);

  // Escape key to close
  useEffect(() => {
    if (!selectedVessel) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedVessel(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedVessel, setSelectedVessel]);

  if (!selectedVessel) return null;
  const vessel = vessels.get(selectedVessel);
  if (!vessel) return null;

  const speedColor = getSpeedColor(vessel.speed);
  const isEastbound = vessel.course >= 0 && vessel.course < 180;
  const direction = isEastbound ? 'Eastbound' : 'Westbound';
  const dirColor = isEastbound ? '#00b4d8' : '#ffab00';
  const progress = getTransitProgress(vessel.lon, vessel.course);

  return (
    <div
      className="absolute top-0 right-0 h-full w-[400px] bg-surface-0 border-l border-border z-20 overflow-y-auto animate-slide-in"
      role="dialog"
      aria-label={`Vessel details: ${vessel.name}`}
    >
      {/* Header */}
      <div className="sticky top-0 bg-surface-0 border-b border-border p-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide leading-tight truncate">{vessel.name}</h2>
            <p className="text-[10px] text-text-dim mt-0.5 font-data">MMSI {vessel.mmsi}</p>
          </div>
          <button
            onClick={() => setSelectedVessel(null)}
            className="text-text-dim hover:text-text-primary transition-colors p-1 ml-2 rounded-sm hover:bg-surface-2"
            aria-label="Close vessel details"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Direction banner */}
        <div
          className="mt-2 flex items-center gap-3 rounded-sm px-2.5 py-1.5 border-l-2"
          style={{ backgroundColor: `${dirColor}10`, borderLeftColor: dirColor }}
          aria-label={`${direction}, ${vessel.speed > 0.5 ? 'in transit' : 'stationary'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ transform: isEastbound ? 'none' : 'scaleX(-1)' }} aria-hidden="true">
            <path d="M5 12h14m-4-4l4 4-4 4" stroke={dirColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: dirColor }}>{direction}</div>
            <div className="text-[10px] text-text-dim">{vessel.speed > 0.5 ? 'In transit' : 'Stationary'}</div>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Navigation gauges */}
        <div className="grid grid-cols-3 gap-1.5">
          <GaugeCard label="Speed" value={formatSpeed(vessel.speed)} color={speedColor} />
          <GaugeCard label="Course" value={`${vessel.course.toFixed(0)}\u00b0`} color="#00b4d8" />
          <GaugeCard label="Heading" value={`${vessel.heading.toFixed(0)}\u00b0`} color="#7c4dff" />
        </div>

        {/* Speed sparkline */}
        {vessel.trail.length > 2 && (
          <Section title={`Speed History (${vessel.trail.length} pts)`}>
            <SpeedSparkline trail={vessel.trail} />
          </Section>
        )}

        {/* Transit progress */}
        <Section title="Transit Progress">
          <div
            className="relative h-1.5 bg-surface-1 rounded-sm overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Transit progress: ${Math.round(progress)}%`}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-sm transition-all"
              style={{ width: `${progress}%`, backgroundColor: dirColor }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-text-dim">Gulf of Oman</span>
            <span className="text-[10px] font-semibold font-data" style={{ color: dirColor }}>{Math.round(progress)}%</span>
            <span className="text-[10px] text-text-dim">Persian Gulf</span>
          </div>
        </Section>

        {/* Vessel Info */}
        <Section title="Vessel Info">
          <InfoRow label="Type" value={vessel.shipTypeLabel} />
          <InfoRow label="Flag" value={vessel.flag || 'Unknown'} />
          <InfoRow label="Status" value={getNavStatusLabel(vessel.navStatus)} />
          <InfoRow label="Position" value={`${vessel.lat.toFixed(4)}\u00b0N, ${vessel.lon.toFixed(4)}\u00b0E`} mono />
          <InfoRow label="Last Update" value={timeAgo(vessel.lastUpdate)} mono />
        </Section>

        {/* Nearby vessels */}
        <NearbyVessels currentMmsi={vessel.mmsi} lat={vessel.lat} lon={vessel.lon} />
      </div>
    </div>
  );
}

function NearbyVessels({ currentMmsi, lat, lon }: { currentMmsi: string; lat: number; lon: number }) {
  const vessels = useStore((s) => s.vessels);
  const setSelectedVessel = useStore((s) => s.setSelectedVessel);

  const nearby = useMemo(() => {
    return [...vessels.values()]
      .filter((v) => v.mmsi !== currentMmsi)
      .map((v) => ({ ...v, dist: haversineNm(lat, lon, v.lat, v.lon) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);
  }, [vessels, currentMmsi, lat, lon]);

  if (nearby.length === 0) return null;

  return (
    <Section title="Nearby Vessels">
      <div className="space-y-0.5" role="list">
        {nearby.map((v) => (
          <button
            key={v.mmsi}
            onClick={() => setSelectedVessel(v.mmsi)}
            role="listitem"
            className="w-full flex items-center justify-between text-[11px] py-1.5 px-1.5 rounded-sm hover:bg-surface-1 transition-colors focus:outline-none focus:bg-surface-1"
            aria-label={`${v.name}, ${formatSpeed(v.speed)}, ${v.dist.toFixed(1)} nautical miles away`}
          >
            <span className="text-text-primary truncate max-w-[180px]">{v.name}</span>
            <div className="flex items-center gap-2">
              <span style={{ color: getSpeedColor(v.speed) }} className="font-data text-[11px]">
                {formatSpeed(v.speed)}
              </span>
              <span className="text-text-dim font-data text-[10px]">
                {v.dist.toFixed(1)}nm
              </span>
            </div>
          </button>
        ))}
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="label-caps border-b border-border-dim pb-1 mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border-dim">
      <span className="text-[10px] text-text-dim uppercase tracking-wider">{label}</span>
      <span className={`text-[11px] text-text-primary font-medium ${mono ? 'font-data' : ''}`}>{value}</span>
    </div>
  );
}

function GaugeCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface-1 rounded-sm p-2 border border-border-dim">
      <div className="label-caps">{label}</div>
      <div className="text-sm font-bold mt-0.5 font-data" style={{ color }}>{value}</div>
    </div>
  );
}
