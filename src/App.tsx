import { useEffect, useState } from 'react';
import { connectDataSource, disconnectDataSource } from './store';
import Map from './components/Map';
import StatsBar from './components/StatsBar';
import VesselPanel from './components/VesselPanel';
import VesselList from './components/VesselList';
import TrafficChart from './components/TrafficChart';
import ChokePointOverlay from './components/ChokePointOverlay';

export default function App() {
  const [sidebarTab, setSidebarTab] = useState<'vessels' | 'analytics'>('vessels');

  useEffect(() => {
    connectDataSource();
    return () => disconnectDataSource();
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-200 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="text-lg font-bold tracking-tight">
            <span className="text-cyan-400">HORMUZ</span>
            <span className="text-slate-400 font-light ml-1">TRACKER</span>
          </div>
          <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-medium uppercase tracking-wider">
            Live AIS
          </span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          Strait of Hormuz · Real-time Tanker Monitoring
        </div>
      </header>

      {/* Stats Bar */}
      <StatsBar />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar */}
        <div className="w-72 flex flex-col border-r border-slate-700/50 bg-slate-900/50">
          {/* Tabs */}
          <div className="flex border-b border-slate-700/50">
            <button
              onClick={() => setSidebarTab('vessels')}
              className={`flex-1 text-xs py-2 font-medium transition-colors ${
                sidebarTab === 'vessels'
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Vessels
            </button>
            <button
              onClick={() => setSidebarTab('analytics')}
              className={`flex-1 text-xs py-2 font-medium transition-colors ${
                sidebarTab === 'analytics'
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Analytics
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {sidebarTab === 'vessels' ? <VesselList /> : <TrafficChart />}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <Map />
          <ChokePointOverlay />
          <VesselPanel />
        </div>
      </div>
    </div>
  );
}
