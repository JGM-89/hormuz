import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { getSpeedColor, formatSpeed, timeAgo } from '../utils/ais';
import { Search, Ship, Anchor, Navigation } from 'lucide-react';

type SortKey = 'name' | 'speed' | 'lastUpdate';
type CategoryFilter = 'all' | 'tanker' | 'cargo' | 'passenger' | 'other';

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: 'All',
  tanker: 'Tankers',
  cargo: 'Cargo',
  passenger: 'Passenger',
  other: 'Other',
};

const CATEGORY_COLORS: Record<CategoryFilter, string> = {
  all: 'bg-accent/15 text-accent',
  tanker: 'bg-red-500/15 text-red-400',
  cargo: 'bg-blue-500/15 text-blue-400',
  passenger: 'bg-emerald-500/15 text-emerald-400',
  other: 'bg-purple-500/15 text-purple-400',
};

const CATEGORY_BORDER: Record<string, string> = {
  tanker: 'border-l-red-400',
  cargo: 'border-l-blue-400',
  passenger: 'border-l-emerald-400',
  other: 'border-l-purple-400',
};

export default function VesselList() {
  const vessels = useStore((s) => s.vessels);
  const selectedVessel = useStore((s) => s.selectedVessel);
  const setSelectedVessel = useStore((s) => s.setSelectedVessel);
  const [sortKey, setSortKey] = useState<SortKey>('speed');
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const sorted = useMemo(() => {
    let list = [...vessels.values()];
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'tanker') {
        list = list.filter((v) => v.isTanker || v.category === 'tanker');
      } else if (categoryFilter === 'other') {
        list = list.filter((v) => !['tanker', 'cargo', 'passenger'].includes(v.category || ''));
      } else {
        list = list.filter((v) => v.category === categoryFilter);
      }
    }
    if (filter) {
      const f = filter.toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(f) ||
          v.mmsi.includes(f) ||
          v.flag.toLowerCase().includes(f),
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'speed') cmp = a.speed - b.speed;
      else cmp = a.lastUpdate - b.lastUpdate;
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [vessels, sortKey, sortAsc, filter, categoryFilter]);

  // Stats
  const totalCount = vessels.size;
  const transitCount = [...vessels.values()].filter((v) => v.speed > 0.5).length;
  const anchoredCount = totalCount - transitCount;
  const movingVessels = [...vessels.values()].filter((v) => v.speed > 0.5);
  const avgSpeed = movingVessels.length > 0
    ? (movingVessels.reduce((s, v) => s + v.speed, 0) / movingVessels.length).toFixed(1)
    : '0.0';

  const toggleSort = (key: SortKey) => {
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
            placeholder="Filter name, MMSI, flag..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-surface-1 border border-border rounded-sm pl-8 pr-2.5 py-1.5 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
            aria-label="Filter vessels"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-border-dim flex-shrink-0" role="tablist" aria-label="Vessel categories">
        {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            role="tab"
            aria-selected={categoryFilter === cat}
            className={`text-[11px] px-2.5 py-0.5 rounded-sm transition-colors uppercase tracking-wider font-semibold ${
              categoryFilter === cat
                ? CATEGORY_COLORS[cat]
                : 'text-text-dim hover:text-text-secondary'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-1.5 px-3 py-2 border-b border-border-dim flex-shrink-0">
        <StatCell label="Total" value={totalCount} />
        <StatCell label="Transit" value={transitCount} color="text-accent" />
        <StatCell label="Anchored" value={anchoredCount} color="text-status-warn" />
        <StatCell label="Avg Spd" value={`${avgSpeed}kn`} />
      </div>

      {/* Sort buttons */}
      <div className="flex gap-1 px-3 py-1.5 border-b border-border-dim flex-shrink-0" role="group" aria-label="Sort vessels by">
        {(['name', 'speed', 'lastUpdate'] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => toggleSort(key)}
            className={`text-[11px] px-2 py-0.5 rounded-sm transition-colors uppercase tracking-wider font-semibold ${
              sortKey === key
                ? 'bg-accent/15 text-accent'
                : 'text-text-dim hover:text-text-secondary'
            }`}
            aria-label={`Sort by ${key === 'lastUpdate' ? 'recent' : key}${sortKey === key ? (sortAsc ? ', ascending' : ', descending') : ''}`}
          >
            {key === 'lastUpdate' ? 'Recent' : key.charAt(0).toUpperCase() + key.slice(1)}
            {sortKey === key && (sortAsc ? ' ↑' : ' ↓')}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-text-dim font-data">{sorted.length}</span>
      </div>

      {/* Vessel list */}
      <div className="flex-1 overflow-y-auto" role="list">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-dim text-xs gap-1">
            <Ship size={20} className="text-text-dim opacity-50" />
            {filter ? 'No vessels match filter' : 'Waiting for vessel data...'}
          </div>
        ) : (
          sorted.map((vessel) => {
            const isMoving = vessel.speed > 0.5;
            const category = vessel.isTanker ? 'tanker' : (vessel.category || 'other');
            const borderColor = CATEGORY_BORDER[category] || 'border-l-transparent';

            return (
              <button
                key={vessel.mmsi}
                onClick={() => setSelectedVessel(vessel.mmsi)}
                role="listitem"
                aria-label={`${vessel.name}, ${formatSpeed(vessel.speed)}, ${vessel.flag || 'Unknown flag'}`}
                className={`w-full text-left px-3 py-2.5 border-b border-border-dim transition-colors focus:outline-none focus:bg-surface-2 border-l-2 ${
                  selectedVessel === vessel.mmsi
                    ? 'bg-accent/10 border-l-accent'
                    : `hover:bg-surface-1 ${borderColor}`
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {isMoving ? (
                      <Ship size={13} className="text-accent flex-shrink-0" />
                    ) : (
                      <Anchor size={13} className="text-status-warn flex-shrink-0" />
                    )}
                    <span className="text-xs font-medium text-text-primary truncate max-w-[140px]">
                      {vessel.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Navigation
                      size={10}
                      className="text-text-dim flex-shrink-0"
                      style={{ transform: `rotate(${vessel.course || 0}deg)` }}
                    />
                    <span
                      className="text-xs font-data font-semibold"
                      style={{ color: getSpeedColor(vessel.speed) }}
                    >
                      {formatSpeed(vessel.speed)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[11px] text-text-dim">
                    {vessel.flag || 'Unknown'} &middot; {vessel.shipTypeLabel}
                  </span>
                  <span className="text-[11px] text-text-dim font-data">{timeAgo(vessel.lastUpdate)}</span>
                </div>
              </button>
            );
          })
        )}
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
