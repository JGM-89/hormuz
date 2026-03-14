import { useMemo } from 'react';
import { useStore } from '../store';
import { getNavStatusLabel, getSpeedColor, formatSpeed, timeAgo } from '../utils/ais';
import { getTransitProgress, haversineNm } from '../utils/geo';
import SpeedSparkline from './SpeedSparkline';

export default function VesselPanel() {
  const selectedVessel = useStore((s) => s.selectedVessel);
  const vessels = useStore((s) => s.vessels);
  const setSelectedVessel = useStore((s) => s.setSelectedVessel);

  if (!selectedVessel) return null;
  const vessel = vessels.get(selectedVessel);
  if (!vessel) return null;

  const speedColor = getSpeedColor(vessel.speed);
  const isEastbound = vessel.course >= 0 && vessel.course < 180;
  const direction = isEastbound ? 'Eastbound' : 'Westbound';
  const dirColor = isEastbound ? '#22d3ee' : '#f59e0b';
  const progress = getTransitProgress(vessel.lon, vessel.course);

  return (
    <div className="absolute top-0 right-0 h-full w-[400px] bg-slate-900/95 backdrop-blur-md border-l border-slate-700/50 z-20 overflow-y-auto shadow-2xl animate-slide-in">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-700/50 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white leading-tight truncate">{vessel.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">MMSI: {vessel.mmsi}</p>
          </div>
          <button
            onClick={() => setSelectedVessel(null)}
            className="text-slate-400 hover:text-white transition-colors p-1 ml-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Direction banner */}
        <div className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: `${dirColor}10`, border: `1px solid ${dirColor}30` }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ transform: isEastbound ? 'none' : 'scaleX(-1)' }}>
            <path d="M5 12h14m-4-4l4 4-4 4" stroke={dirColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="text-sm font-bold uppercase tracking-wider" style={{ color: dirColor }}>{direction}</div>
            <div className="text-[10px] text-slate-400">{vessel.speed > 0.5 ? 'In transit' : 'Stationary'}</div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Navigation gauges */}
        <div className="grid grid-cols-3 gap-2">
          <GaugeCard label="Speed" value={formatSpeed(vessel.speed)} color={speedColor} />
          <GaugeCard label="Course" value={`${vessel.course.toFixed(0)}\u00b0`} color="#22d3ee" />
          <GaugeCard label="Heading" value={`${vessel.heading.toFixed(0)}\u00b0`} color="#8b5cf6" />
        </div>

        {/* Speed sparkline */}
        {vessel.trail.length > 2 && (
          <Section title={`Speed History (${vessel.trail.length} pts)`}>
            <SpeedSparkline trail={vessel.trail} />
          </Section>
        )}

        {/* Transit progress */}
        <Section title="Transit Progress">
          <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{ width: `${progress}%`, backgroundColor: dirColor }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-slate-500">Gulf of Oman</span>
            <span className="text-[10px] font-semibold" style={{ color: dirColor }}>{Math.round(progress)}%</span>
            <span className="text-[10px] text-slate-500">Persian Gulf</span>
          </div>
        </Section>

        {/* Vessel Info */}
        <Section title="Vessel Info">
          <InfoRow label="Type" value={vessel.shipTypeLabel} />
          <InfoRow label="Flag" value={vessel.flag || 'Unknown'} />
          <InfoRow label="Status" value={getNavStatusLabel(vessel.navStatus)} />
          <InfoRow label="Position" value={`${vessel.lat.toFixed(4)}\u00b0N, ${vessel.lon.toFixed(4)}\u00b0E`} />
          <InfoRow label="Last Update" value={timeAgo(vessel.lastUpdate)} />
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
      <div className="space-y-1">
        {nearby.map((v) => (
          <button
            key={v.mmsi}
            onClick={() => setSelectedVessel(v.mmsi)}
            className="w-full flex items-center justify-between text-xs py-1 px-1 rounded hover:bg-slate-800/50 transition-colors"
          >
            <span className="text-slate-300 truncate max-w-[180px]">{v.name}</span>
            <div className="flex items-center gap-2">
              <span style={{ color: getSpeedColor(v.speed) }} className="font-mono text-[10px]">
                {formatSpeed(v.speed)}
              </span>
              <span className="text-slate-500 font-mono text-[10px]">
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
      <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-800/50">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs text-slate-200 font-medium">{value}</span>
    </div>
  );
}

function GaugeCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/30">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-bold mt-0.5" style={{ color }}>{value}</div>
    </div>
  );
}
