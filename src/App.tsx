import { useEffect, useState } from 'react';
import { connectDataSource, disconnectDataSource } from './store';
import Map from './components/Map';
import LogoPill from './components/LogoPill';
import FloatingStats from './components/FloatingStats';
import VesselDrawer from './components/VesselDrawer';
import VesselPanel from './components/VesselPanel';
import ChokePointOverlay from './components/ChokePointOverlay';
import AnalyticsModal from './components/AnalyticsModal';
import OutageOverlay from './components/OutageOverlay';
import WeatherWidget from './components/WeatherWidget';
import NewsTicker from './components/NewsTicker';
import OilPriceWidget from './components/OilPriceWidget';

export default function App() {
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  useEffect(() => {
    connectDataSource();
    return () => disconnectDataSource();
  }, []);

  return (
    <div className="h-screen w-screen relative bg-slate-950 text-slate-200 overflow-hidden">
      {/* Map fills entire viewport */}
      <Map />

      {/*
        Layout overlay: flexbox zones replace individual absolute positioning.
        pointer-events-none lets clicks pass through to the map;
        each zone re-enables pointer-events for its interactive children.
      */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        {/* === TOP ROW: logo | stats+outage | oil price === */}
        <div className="flex items-start justify-between p-4 gap-4 flex-shrink-0">
          <div className="pointer-events-auto flex-shrink-0">
            <LogoPill />
          </div>
          <div className="pointer-events-auto flex flex-col items-center gap-2 min-w-0">
            <FloatingStats />
            <OutageOverlay />
          </div>
          <div className="pointer-events-auto flex-shrink-0">
            <OilPriceWidget />
          </div>
        </div>

        {/* === MIDDLE: vessel drawer tab (left-aligned) === */}
        <div className="flex-1 min-h-0 flex items-start px-4">
          <div className="pointer-events-auto">
            <VesselDrawer />
          </div>
        </div>

        {/* === BOTTOM ROW: chokepoint | spacer | weather+analytics === */}
        <div className="flex items-end justify-between p-4 gap-4 flex-shrink-0">
          <div className="pointer-events-auto flex-shrink-0 max-w-[260px]">
            <ChokePointOverlay />
          </div>
          <div className="flex-1" />
          <div className="pointer-events-auto flex-shrink-0 flex flex-col items-end gap-2">
            <WeatherWidget />
            <button
              onClick={() => setAnalyticsOpen(true)}
              className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-lg px-3 py-1.5 shadow-xl hover:bg-slate-800/80 active:bg-slate-700/80 transition-colors group flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              aria-label="Open analytics dashboard"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-slate-400 group-hover:text-cyan-400 transition-colors" aria-hidden="true">
                <rect x="1" y="8" width="3" height="7" rx="0.5" fill="currentColor" opacity="0.6" />
                <rect x="5.5" y="5" width="3" height="10" rx="0.5" fill="currentColor" opacity="0.8" />
                <rect x="10" y="1" width="3" height="14" rx="0.5" fill="currentColor" />
              </svg>
              <span className="text-xs text-slate-400 group-hover:text-cyan-400 transition-colors uppercase tracking-wider font-semibold">Analytics</span>
            </button>
          </div>
        </div>

        {/* === BOTTOM TICKER: always flush bottom === */}
        <div className="pointer-events-auto flex-shrink-0">
          <NewsTicker />
        </div>
      </div>

      {/* Full-height sidebars stay absolute z-20 (they overlay everything) */}
      <VesselPanel />

      {/* Analytics full-screen overlay */}
      <AnalyticsModal open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />
    </div>
  );
}
