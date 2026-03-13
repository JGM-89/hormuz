import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { getSpeedColor, formatSpeed, timeAgo } from '../utils/ais';

type SortKey = 'name' | 'speed' | 'lastUpdate';

export default function VesselList() {
  const vessels = useStore((s) => s.vessels);
  const selectedVessel = useStore((s) => s.selectedVessel);
  const setSelectedVessel = useStore((s) => s.setSelectedVessel);
  const [sortKey, setSortKey] = useState<SortKey>('speed');
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState('');

  const sorted = useMemo(() => {
    let list = [...vessels.values()];

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
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 backdrop-blur-sm">
      {/* Header */}
      <div className="p-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Vessels ({sorted.length})
          </h2>
        </div>
        <input
          type="text"
          placeholder="Filter by name, MMSI, flag..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
        />
      </div>

      {/* Sort buttons */}
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
            {sortKey === key && (sortAsc ? ' ↑' : ' ↓')}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-500 text-xs">
            {filter ? 'No vessels match filter' : 'Waiting for vessel data...'}
          </div>
        ) : (
          sorted.map((vessel) => (
            <button
              key={vessel.mmsi}
              onClick={() => setSelectedVessel(vessel.mmsi)}
              className={`w-full text-left px-3 py-2 border-b border-slate-800/30 transition-colors ${
                selectedVessel === vessel.mmsi
                  ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400'
                  : 'hover:bg-slate-800/50 border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200 truncate max-w-[140px]">
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
  );
}
