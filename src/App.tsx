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

      {/* Floating UI */}
      <LogoPill />
      <FloatingStats />
      <VesselDrawer />
      <VesselPanel />
      <ChokePointOverlay />
      <OutageOverlay />
      <WeatherWidget />
      <OilPriceWidget />
      <NewsTicker />

      {/* Analytics toggle button */}
      <button
        onClick={() => setAnalyticsOpen(true)}
        className="absolute bottom-10 right-4 z-20 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-lg p-2.5 shadow-xl hover:bg-slate-800/80 transition-colors group"
        title="Open Analytics"
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-slate-400 group-hover:text-cyan-400 transition-colors">
          <rect x="1" y="8" width="3" height="7" rx="0.5" fill="currentColor" opacity="0.6" />
          <rect x="5.5" y="5" width="3" height="10" rx="0.5" fill="currentColor" opacity="0.8" />
          <rect x="10" y="1" width="3" height="14" rx="0.5" fill="currentColor" />
        </svg>
      </button>

      {/* Analytics full-screen overlay */}
      <AnalyticsModal open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />
    </div>
  );
}
