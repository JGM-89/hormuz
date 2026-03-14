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
  }, [vessels, sortKey, sortAsc, filter]);

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
          className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-lg px-3 py-2 shadow-xl hover:bg-slate-800/80 transition-colors group"
        >
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-cyan-400">
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-xs font-medium text-slate-300">
              Vessels
            </span>
            <span className="text-[10px] font-bold text-cyan-400 bg-cyan-400/10 rounded-full px-1.5 py-0.5">
              {vessels.size}
            </span>
          </div>
        </button>
      )}

      {/* Expanded drawer */}
      {open && (
        <div className="absolute top-0 left-0 h-full w-80 z-20 flex flex-col bg-slate-900/95 backdrop-blur-md border-r border-slate-700/50 shadow-2xl animate-slide-in-left">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-slate-700/50">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Vessels ({sorted.length})
            </h2>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Filter */}
          <div className="px-3 py-2 border-b border-slate-700/50">
            <input
              type="text"
              placeholder="Filter by name, MMSI, flag..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {/* Category filter */}
          <div className="flex gap-1 px-3 py-1.5 border-b border-slate-800/50">
            {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                  categoryFilter === cat
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex gap-1 px-3 py-1.5 border-b border-slate-800/50">
            {(['name', 'speed', 'lastUpdate'] as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                  sortKey === key
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {key === 'lastUpdate' ? 'Recent' : key.charAt(0).toUpperCase() + key.slice(1)}
                {sortKey === key && (sortAsc ? ' \u2191' : ' \u2193')}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-slate-500 text-xs">
                {filter ? 'No vessels match filter' : 'No vessel data'}
              </div>
            ) : (
              sorted.map((vessel) => (
                <button
                  key={vessel.mmsi}
                  onClick={() => { setSelectedVessel(vessel.mmsi); setOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 border-b border-slate-800/30 transition-colors ${
                    selectedVessel === vessel.mmsi
                      ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400'
                      : 'hover:bg-slate-800/50 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-200 truncate max-w-[160px]">
                      {vessel.name}
                    </span>
                    <span
                      className="text-[10px] font-mono font-semibold"
                      style={{ color: getSpeedColor(vessel.speed) }}
                    >
                      {formatSpeed(vessel.speed)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[10px] text-slate-500">
                      {vessel.flag || 'Unknown'} · {vessel.shipTypeLabel}
                    </span>
                    <span className="text-[10px] text-slate-500">{timeAgo(vessel.lastUpdate)}</span>
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
