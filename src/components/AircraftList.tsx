import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Search, Plane } from 'lucide-react';
import type { Aircraft } from '../types';

function formatAltitude(alt: number): string {
  if (alt <= 0) return 'Ground';
  return `${Math.round(alt).toLocaleString()} m`;
}

function formatVelocity(v: number): string {
  // OpenSky gives m/s, convert to knots
  const kn = v * 1.94384;
  return `${kn.toFixed(0)} kn`;
}

function getAltitudeColor(alt: number): string {
  if (alt <= 0) return '#64748b';
  if (alt < 1000) return '#f59e0b';   // low — amber
  if (alt < 5000) return '#22d3ee';   // medium — cyan
  return '#7c4dff';                    // high — purple
}

const MILITARY_PATTERNS = /^(RCH|DUKE|NEMO|RRR|CNV|EVAC|JAKE|TOPCAT|ROMA|NAVY|VIPER|COBRA|REAPER|HAWK|EAGLE|MAGIC|ATLAS|GIANT|REACH|KING|BOLT|SPAR|DOOM|IRON|STEEL)/i;

function isMilitaryCallsign(callsign: string): boolean {
  return MILITARY_PATTERNS.test(callsign.trim());
}

export default function AircraftList() {
  const aircraft = useStore((s) => s.aircraft);
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<'callsign' | 'altitude' | 'velocity'>('altitude');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    let list = [...aircraft.values()];
    if (filter) {
      const f = filter.toLowerCase();
      list = list.filter(
        (a) =>
          a.callsign.toLowerCase().includes(f) ||
          a.icao24.toLowerCase().includes(f) ||
          a.originCountry.toLowerCase().includes(f),
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'callsign') cmp = a.callsign.localeCompare(b.callsign);
      else if (sortKey === 'altitude') cmp = a.altitude - b.altitude;
      else cmp = a.velocity - b.velocity;
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [aircraft, sortKey, sortAsc, filter]);

  const militaryCount = useMemo(
    () => [...aircraft.values()].filter((a) => isMilitaryCallsign(a.callsign)).length,
    [aircraft],
  );

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2.5 border-b border-border-dim flex-shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            placeholder="Filter callsign, ICAO, country..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-surface-1 border border-border rounded-sm pl-8 pr-2.5 py-1.5 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
            aria-label="Filter aircraft"
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-1.5 px-3 py-2 border-b border-border-dim flex-shrink-0">
        <StatCell label="Tracked" value={aircraft.size} />
        <StatCell label="Military" value={militaryCount} color="text-red-400" />
        <StatCell label="Civilian" value={aircraft.size - militaryCount} color="text-accent" />
      </div>

      {/* Sort buttons */}
      <div className="flex gap-1 px-3 py-1.5 border-b border-border-dim flex-shrink-0" role="group" aria-label="Sort aircraft by">
        {(['callsign', 'altitude', 'velocity'] as const).map((key) => (
          <button
            key={key}
            onClick={() => toggleSort(key)}
            className={`text-[11px] px-2 py-0.5 rounded-sm transition-colors uppercase tracking-wider font-semibold ${
              sortKey === key
                ? 'bg-accent/15 text-accent'
                : 'text-text-dim hover:text-text-secondary'
            }`}
            aria-label={`Sort by ${key}`}
          >
            {key === 'velocity' ? 'Speed' : key.charAt(0).toUpperCase() + key.slice(1)}
            {sortKey === key && (sortAsc ? ' ↑' : ' ↓')}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-text-dim font-data">{sorted.length}</span>
      </div>

      {/* Aircraft list */}
      <div className="flex-1 overflow-y-auto" role="list">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-dim text-xs gap-1">
            <Plane size={20} className="text-text-dim opacity-50" />
            {filter ? 'No aircraft match filter' : 'No aircraft tracked'}
          </div>
        ) : (
          sorted.map((ac) => (
            <AircraftRow key={ac.icao24} aircraft={ac} />
          ))
        )}
      </div>
    </div>
  );
}

function AircraftRow({ aircraft: ac }: { aircraft: Aircraft }) {
  const isMil = isMilitaryCallsign(ac.callsign);
  const borderColor = isMil ? 'border-l-red-400' : 'border-l-purple-400';

  return (
    <div
      role="listitem"
      className={`w-full text-left px-3 py-2.5 border-b border-border-dim border-l-2 ${borderColor}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Plane
            size={13}
            className={`flex-shrink-0 ${isMil ? 'text-red-400' : 'text-purple-400'}`}
            style={{ transform: `rotate(${ac.heading || 0}deg)` }}
          />
          <span className="text-xs font-medium text-text-primary truncate max-w-[140px]">
            {ac.callsign.trim() || ac.icao24}
          </span>
          {isMil && (
            <span className="text-[9px] px-1 py-px rounded-sm bg-red-500/20 text-red-400 font-semibold uppercase">
              MIL
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-data font-semibold"
            style={{ color: getAltitudeColor(ac.altitude) }}
          >
            {formatAltitude(ac.altitude)}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[11px] text-text-dim">
          {ac.originCountry} &middot; {ac.icao24.toUpperCase()}
        </span>
        <span className="text-[11px] text-text-dim font-data">{formatVelocity(ac.velocity)}</span>
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-surface-1 rounded-sm px-2 py-1.5 text-center">
      <div className="text-[10px] text-text-dim uppercase tracking-wider font-semibold">{label}</div>
      <div className={`text-sm font-data font-bold ${color || 'text-white'}`}>{value}</div>
    </div>
  );
}
