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
import Widget from './components/Widget';

export default function App() {
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  useEffect(() => {
    connectDataSource();
    return () => disconnectDataSource();
  }, []);

  return (
    <div className="h-screen w-screen relative bg-base text-text-primary overflow-hidden select-none command-grid">
      {/* Map fills entire viewport */}
      <div className="absolute inset-0 map-vignette">
        <Map />
      </div>

      {/* Layout overlay — independent absolute positioning per widget group */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* TOP LEFT: Logo */}
        <div className="absolute top-3 left-3 pointer-events-auto">
          <LogoPill />
        </div>

        {/* TOP CENTER: Stats + Outage */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto flex flex-col items-center gap-1.5">
          <FloatingStats />
          <OutageOverlay />
        </div>

        {/* TOP RIGHT: Oil Price */}
        <div className="absolute top-3 right-3 pointer-events-auto">
          <OilPriceWidget />
        </div>

        {/* LEFT: Vessel Drawer */}
        <div className="absolute top-16 left-3 pointer-events-auto">
          <VesselDrawer />
        </div>

        {/* BOTTOM LEFT: Choke Point */}
        <div className="absolute bottom-11 left-3 pointer-events-auto max-w-[260px]">
          <ChokePointOverlay />
        </div>

        {/* BOTTOM RIGHT: Weather + Analytics */}
        <div className="absolute bottom-11 right-3 pointer-events-auto flex flex-col items-end gap-1.5">
          <WeatherWidget />
          <AnalyticsButton onClick={() => setAnalyticsOpen(true)} />
        </div>

        {/* BOTTOM TICKER: full width, flush bottom */}
        <div className="absolute bottom-0 inset-x-0 pointer-events-auto">
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

function AnalyticsButton({ onClick }: { onClick: () => void }) {
  return (
    <Widget
      className="cursor-pointer hover:bg-surface-2 active:bg-surface-1 transition-colors group"
      role="button"
      tabIndex={0}
      aria-label="Open analytics dashboard"
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-text-dim group-hover:text-accent transition-colors" aria-hidden="true">
          <rect x="1" y="8" width="3" height="7" rx="0.5" fill="currentColor" opacity="0.6" />
          <rect x="5.5" y="5" width="3" height="10" rx="0.5" fill="currentColor" opacity="0.8" />
          <rect x="10" y="1" width="3" height="14" rx="0.5" fill="currentColor" />
        </svg>
        <span className="text-[11px] text-text-dim group-hover:text-accent transition-colors uppercase tracking-widest font-semibold">Analytics</span>
      </div>
    </Widget>
  );
}
