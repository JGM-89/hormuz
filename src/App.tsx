import { useEffect, useState } from 'react';
import { connectDataSource, disconnectDataSource } from './store';
import Map from './components/Map';
import LogoPill from './components/LogoPill';
import FloatingStats from './components/FloatingStats';
import VesselPanel from './components/VesselPanel';
import ChokePointOverlay from './components/ChokePointOverlay';
import AnalyticsModal from './components/AnalyticsModal';
import OutageOverlay from './components/OutageOverlay';
import NewsTicker from './components/NewsTicker';
import ResizablePanel from './components/ResizablePanel';
import VesselList from './components/VesselList';
import AircraftList from './components/AircraftList';
import AnalyticsSidebar from './components/AnalyticsSidebar';
import CommodityPanel from './components/CommodityPanel';
import WeatherPanel from './components/WeatherPanel';
import AudioController from './components/AudioController';
import LayerToggle from './components/LayerToggle';

// Icons for panel collapse state
const VesselIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 15l4-8 4 4 4-6 4 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 20h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="1" y="8" width="3" height="7" rx="0.5" fill="currentColor" opacity="0.6" />
    <rect x="5.5" y="5" width="3" height="10" rx="0.5" fill="currentColor" opacity="0.8" />
    <rect x="10" y="1" width="3" height="14" rx="0.5" fill="currentColor" />
  </svg>
);

export default function App() {
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<'vessels' | 'aircraft'>('vessels');

  useEffect(() => {
    connectDataSource();
    return () => disconnectDataSource();
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-base text-text-primary overflow-hidden select-none command-grid">
      {/* ── TOP BAR ── */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-surface-0 border-b border-border flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          <LogoPill />
        </div>

        <div className="flex items-center gap-2">
          <FloatingStats />
          <OutageOverlay />
        </div>

        <div className="flex items-center gap-2">
          <AudioController />
        </div>
      </header>

      {/* ── MAIN 3-COLUMN GRID ── */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT PANEL: Vessels / Aircraft */}
        <ResizablePanel
          side="left"
          defaultWidth={320}
          minWidth={240}
          maxWidth={500}
          storageKey="vessels"
          title={leftTab === 'vessels' ? 'Vessels' : 'Aircraft'}
          icon={<VesselIcon />}
        >
          <div className="flex flex-col h-full">
            {/* Tab switcher */}
            <div className="flex border-b border-border flex-shrink-0">
              <button
                onClick={() => setLeftTab('vessels')}
                className={`flex-1 text-[11px] py-2 uppercase tracking-wider font-semibold transition-colors ${
                  leftTab === 'vessels'
                    ? 'text-accent border-b-2 border-accent bg-accent/5'
                    : 'text-text-dim hover:text-text-secondary'
                }`}
              >
                Vessels
              </button>
              <button
                onClick={() => setLeftTab('aircraft')}
                className={`flex-1 text-[11px] py-2 uppercase tracking-wider font-semibold transition-colors ${
                  leftTab === 'aircraft'
                    ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-400/5'
                    : 'text-text-dim hover:text-text-secondary'
                }`}
              >
                Aircraft
              </button>
            </div>
            {/* Tab content */}
            <div className="flex-1 min-h-0">
              {leftTab === 'vessels' ? <VesselList /> : <AircraftList />}
            </div>
          </div>
        </ResizablePanel>

        {/* CENTER: Map with floating overlays */}
        <div className="flex-1 relative min-w-0">
          <div className="absolute inset-0 map-vignette">
            <Map />
          </div>

          {/* Floating overlays — absolutely positioned within the map area */}
          <div className="absolute inset-0 z-10 pointer-events-none">
            {/* Bottom-left: Choke point (above MapLibre attribution) */}
            <div className="absolute bottom-8 left-3 pointer-events-auto max-w-[260px]">
              <ChokePointOverlay />
            </div>
            {/* Bottom-right: Layer toggle */}
            <LayerToggle />
          </div>
        </div>

        {/* RIGHT PANEL: Commodities + Weather + Analytics */}
        <ResizablePanel
          side="right"
          defaultWidth={360}
          minWidth={280}
          maxWidth={520}
          storageKey="analytics"
          title="Analytics"
          icon={<AnalyticsIcon />}
        >
          <div className="flex flex-col h-full">
            {/* Commodity prices — expandable rows with sparklines */}
            <div className="border-b border-border flex-shrink-0 overflow-y-auto max-h-[50%]">
              <CommodityPanel />
            </div>

            {/* Weather & Strait conditions */}
            <div className="border-b border-border flex-shrink-0">
              <WeatherPanel />
            </div>

            {/* Analytics charts & alerts — fills remaining space */}
            <div className="flex-1 min-h-0">
              <AnalyticsSidebar onExpandClick={() => setAnalyticsOpen(true)} />
            </div>
          </div>
        </ResizablePanel>
      </div>

      {/* ── BOTTOM: News Ticker ── */}
      <div className="flex-shrink-0 z-20">
        <NewsTicker />
      </div>

      {/* ── OVERLAYS ── */}
      {/* Vessel detail panel (slides over from right) */}
      <VesselPanel />

      {/* Full analytics modal */}
      <AnalyticsModal open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />
    </div>
  );
}
