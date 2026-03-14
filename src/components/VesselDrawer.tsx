import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { getSpeedColor, formatSpeed, timeAgo } from '../utils/ais';

type SortKey = 'name' | 'speed' | 'lastUpdate';
type CategoryFilter = 'all' | 'tanker' | 'cargo' | 'passenger' | 'other';

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: 'All',
  tanker: 'Tankers',
  cargo: 'Cargo',
  passenger: 'Passenger',
  other: 'Other',
};

export default function VesselDrawer() {
  const vessels = useStore((s) => s.vessels);
  const selectedVessel = useStore((s) => s.selectedVessel);
  const setSelectedVessel = useStore((s) => s.setSelectedVessel);
  const [open, setOpen] = useState(false);
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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  return (
    <>
      {/* Collapsed tab */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="bg-surface-0 border border-border rounded-sm px-2.5 py-1.5 hover:bg-surface-2 transition-colors group"
          aria-label={`Open vessel list. ${vessels.size} vessels tracked`}
        >
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-accent" aria-hidden="true">
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
              Vessels
            </span>
            <span className="text-[10px] font-bold text-accent bg-accent/15 rounded-sm px-1.5 py-0.5 font-data">
              {vessels.size}
            </span>
          </div>
        </button>
      )}

      {/* Expanded drawer */}
      {open && (
        <div
          className="absolute top-0 left-0 h-full w-80 z-20 flex flex-col bg-surface-0 border-r border-border animate-slide-in-left"
          role="dialog"
          aria-label="Vessel list"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-2.5 border-b border-border">
            <h2 className="label-caps">
              Vessels ({sorted.length})
            </h2>
            <button
              onClick={() => setOpen(false)}
              className="text-text-dim hover:text-text-primary transition-colors p-1 rounded-sm hover:bg-surface-2"
              aria-label="Close vessel list"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Filter */}
          <div className="px-2.5 py-2 border-b border-border-dim">
            <input
              type="text"
              placeholder="Filter by name, MMSI, flag..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-surface-1 border border-border rounded-sm px-2.5 py-1.5 text-[11px] text-text-primary placeholder-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
              aria-label="Filter vessels"
            />
          </div>

          {/* Category filter */}
          <div className="flex gap-1 px-2.5 py-1.5 border-b border-border-dim" role="tablist" aria-label="Vessel categories">
            {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                role="tab"
                aria-selected={categoryFilter === cat}
                className={`text-[10px] px-2 py-0.5 rounded-sm transition-colors uppercase tracking-wider font-semibold ${
                  categoryFilter === cat
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-dim hover:text-text-secondary'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex gap-1 px-2.5 py-1.5 border-b border-border-dim" role="group" aria-label="Sort vessels by">
            {(['name', 'speed', 'lastUpdate'] as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                className={`text-[10px] px-2 py-0.5 rounded-sm transition-colors uppercase tracking-wider font-semibold ${
                  sortKey === key
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-dim hover:text-text-secondary'
                }`}
                aria-label={`Sort by ${key === 'lastUpdate' ? 'recent' : key}${sortKey === key ? (sortAsc ? ', ascending' : ', descending') : ''}`}
              >
                {key === 'lastUpdate' ? 'Recent' : key.charAt(0).toUpperCase() + key.slice(1)}
                {sortKey === key && (sortAsc ? ' \u2191' : ' \u2193')}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto" role="list">
            {sorted.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-text-dim text-[11px]">
                {filter ? 'No vessels match filter' : 'No vessel data'}
              </div>
            ) : (
              sorted.map((vessel) => (
                <button
                  key={vessel.mmsi}
                  onClick={() => { setSelectedVessel(vessel.mmsi); setOpen(false); }}
                  role="listitem"
                  aria-label={`${vessel.name}, ${formatSpeed(vessel.speed)}, ${vessel.flag || 'Unknown flag'}`}
                  className={`w-full text-left px-2.5 py-2 border-b border-border-dim transition-colors focus:outline-none focus:bg-surface-2 ${
                    selectedVessel === vessel.mmsi
                      ? 'bg-accent/10 border-l-2 border-l-accent'
                      : 'hover:bg-surface-1 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-text-primary truncate max-w-[160px]">
                      {vessel.name}
                    </span>
                    <span
                      className="text-[11px] font-data font-semibold"
                      style={{ color: getSpeedColor(vessel.speed) }}
                    >
                      {formatSpeed(vessel.speed)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[10px] text-text-dim">
                      {vessel.flag || 'Unknown'} &middot; {vessel.shipTypeLabel}
                    </span>
                    <span className="text-[10px] text-text-dim font-data">{timeAgo(vessel.lastUpdate)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
