import { useEffect } from 'react';
import { useStore } from '../store';
import { Plane } from 'lucide-react';

const MILITARY_PATTERNS = /^(RCH|DUKE|NEMO|RRR|CNV|EVAC|JAKE|TOPCAT|ROMA|NAVY|VIPER|COBRA|REAPER|HAWK|EAGLE|MAGIC|ATLAS|GIANT|REACH|KING|BOLT|SPAR|DOOM|IRON|STEEL)/i;

function isMilitaryCallsign(callsign: string): boolean {
  return MILITARY_PATTERNS.test(callsign.trim());
}

function formatAltitude(alt: number): string {
  if (alt <= 0) return 'Ground';
  return `${Math.round(alt).toLocaleString()} m`;
}

function formatAltitudeFt(alt: number): string {
  if (alt <= 0) return 'Ground';
  const ft = Math.round(alt * 3.28084);
  return `FL${Math.round(ft / 100)}`;
}

function formatVelocity(v: number): string {
  const kn = v * 1.94384;
  return `${kn.toFixed(0)} kn`;
}

function getAltitudeColor(alt: number): string {
  if (alt <= 0) return '#64748b';
  if (alt < 1000) return '#f59e0b';
  if (alt < 5000) return '#22d3ee';
  return '#7c4dff';
}

// Rough aircraft category labels from OpenSky category codes
function getCategoryLabel(cat: number): string {
  switch (cat) {
    case 1: return 'No category info';
    case 2: return 'Light (< 7000 kg)';
    case 3: return 'Medium (7000–136000 kg)';
    case 4: return 'Heavy (> 136000 kg)';
    case 5: return 'High vortex';
    case 6: return 'Very heavy (> 300000 kg)';
    case 7: return 'Rotorcraft';
    case 8: return 'Glider / Balloon';
    case 9: return 'Lighter-than-air';
    case 10: return 'Skydiver';
    case 11: return 'Ultralight';
    case 12: return 'UAV';
    case 13: return 'Space vehicle';
    case 14: return 'Emergency vehicle';
    case 15: return 'Service vehicle';
    default: return 'Unknown';
  }
}

export default function AircraftPanel() {
  const selectedAircraft = useStore((s) => s.selectedAircraft);
  const aircraft = useStore((s) => s.aircraft);
  const setSelectedAircraft = useStore((s) => s.setSelectedAircraft);

  // Escape key to close
  useEffect(() => {
    if (!selectedAircraft) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedAircraft(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedAircraft, setSelectedAircraft]);

  if (!selectedAircraft) return null;
  const ac = aircraft.get(selectedAircraft);
  if (!ac) return null;

  const isMil = isMilitaryCallsign(ac.callsign);
  const callsign = ac.callsign.trim() || ac.icao24.toUpperCase();
  const altColor = getAltitudeColor(ac.altitude);

  return (
    <div
      className="absolute top-0 right-0 h-full w-[400px] bg-surface-0 border-l border-border z-20 overflow-y-auto animate-slide-in"
      role="dialog"
      aria-label={`Aircraft details: ${callsign}`}
    >
      {/* Header */}
      <div className="sticky top-0 bg-surface-0 border-b border-border p-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Plane size={16} className={isMil ? 'text-red-400' : 'text-purple-400'} style={{ transform: `rotate(${ac.heading || 0}deg)` }} />
              <h2 className="text-sm font-bold text-white uppercase tracking-wide leading-tight truncate">{callsign}</h2>
              {isMil && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-red-500/20 text-red-400 font-semibold uppercase">MIL</span>
              )}
            </div>
            <p className="text-[10px] text-text-dim mt-0.5 font-data">ICAO24 {ac.icao24.toUpperCase()}</p>
          </div>
          <button
            onClick={() => setSelectedAircraft(null)}
            className="text-text-dim hover:text-text-primary transition-colors p-1 ml-2 rounded-sm hover:bg-surface-2"
            aria-label="Close aircraft details"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Type banner */}
        <div
          className="mt-2 flex items-center gap-3 rounded-sm px-2.5 py-1.5 border-l-2"
          style={{
            backgroundColor: isMil ? 'rgba(248,113,113,0.06)' : 'rgba(124,77,255,0.06)',
            borderLeftColor: isMil ? '#f87171' : '#7c4dff',
          }}
        >
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: isMil ? '#f87171' : '#7c4dff' }}>
              {isMil ? 'Military' : 'Civilian'} Aircraft
            </div>
            <div className="text-[10px] text-text-dim">{ac.originCountry} &middot; {ac.onGround ? 'On ground' : 'Airborne'}</div>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Flight gauges */}
        <div className="grid grid-cols-3 gap-1.5">
          <GaugeCard label="Altitude" value={formatAltitude(ac.altitude)} color={altColor} />
          <GaugeCard label="Speed" value={formatVelocity(ac.velocity)} color="#00b4d8" />
          <GaugeCard label="Heading" value={`${(ac.heading || 0).toFixed(0)}\u00b0`} color="#7c4dff" />
        </div>

        {/* Flight info */}
        <Section title="Flight Info">
          <InfoRow label="Flight Level" value={formatAltitudeFt(ac.altitude)} mono />
          <InfoRow label="Category" value={getCategoryLabel(ac.category)} />
          <InfoRow label="Origin" value={ac.originCountry} />
          <InfoRow label="On Ground" value={ac.onGround ? 'Yes' : 'No'} />
          <InfoRow label="Position" value={`${ac.lat.toFixed(4)}\u00b0N, ${ac.lon.toFixed(4)}\u00b0E`} mono />
        </Section>

        {/* External links */}
        <Section title="Track Online">
          <div className="flex gap-2">
            <a
              href={`https://www.flightradar24.com/${ac.callsign.trim()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-accent hover:text-accent/80 underline"
            >
              FlightRadar24
            </a>
            <a
              href={`https://globe.adsbexchange.com/?icao=${ac.icao24}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-accent hover:text-accent/80 underline"
            >
              ADS-B Exchange
            </a>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="label-caps border-b border-border-dim pb-1 mb-2">{title}</h3>
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
