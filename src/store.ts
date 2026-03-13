import { create } from 'zustand';
import type { Vessel, Transit, Stats, WSMessage, HistoricalData } from './types';

// Data source config — set via env vars at build time
const GITHUB_RAW_BASE = import.meta.env.VITE_GITHUB_RAW_BASE; // e.g. "https://raw.githubusercontent.com/user/hormuz/data"
const API_BASE = import.meta.env.VITE_API_BASE; // e.g. "http://nas-ip:3001" for direct access

function getDataMode(): 'github' | 'api' | 'ws' {
  if (GITHUB_RAW_BASE) return 'github';
  if (API_BASE) return 'api';
  return 'ws';
}

interface AisHealth {
  status: 'live' | 'outage' | 'waiting' | 'connecting';
  lastMessage: number | null;
  reconnects: number;
  serverUptime: number;
}

interface AppState {
  vessels: Map<string, Vessel>;
  selectedVessel: string | null;
  stats: Stats;
  transitHistory: Transit[];
  historicalData: HistoricalData | null;
  aisHealth: AisHealth | null;
  connected: boolean;
  dataMode: 'github' | 'api' | 'ws';
  lastFetch: number;
  setSelectedVessel: (mmsi: string | null) => void;
  handleMessage: (msg: WSMessage) => void;
  setConnected: (connected: boolean) => void;
  setHistoricalData: (data: HistoricalData) => void;
  setAisHealth: (health: AisHealth | null) => void;
  setLiveData: (vessels: Record<string, Vessel>, stats: Stats, transits: Transit[], aisHealth?: AisHealth | null) => void;
}

const defaultStats: Stats = {
  totalVessels: 0,
  inTransit: 0,
  anchored: 0,
  avgSpeed: 0,
  messageCount: 0,
  lastUpdate: 0,
};

export const useStore = create<AppState>((set) => ({
  vessels: new Map(),
  selectedVessel: null,
  stats: defaultStats,
  transitHistory: [],
  historicalData: null,
  aisHealth: null,
  connected: false,
  dataMode: getDataMode(),
  lastFetch: 0,

  setSelectedVessel: (mmsi) => set({ selectedVessel: mmsi }),
  setConnected: (connected) => set({ connected }),
  setHistoricalData: (data) => set({ historicalData: data }),
  setAisHealth: (health) => set({ aisHealth: health }),

  setLiveData: (vessels, stats, transits, aisHealth) => set({
    vessels: new Map(Object.entries(vessels)),
    stats,
    transitHistory: transits,
    aisHealth: aisHealth ?? null,
    lastFetch: Date.now(),
    connected: true,
  }),

  handleMessage: (msg) => {
    switch (msg.type) {
      case 'snapshot':
        set({
          vessels: new Map(Object.entries(msg.vessels)),
          stats: msg.stats,
          transitHistory: msg.transitHistory,
        });
        break;
      case 'vessel_update':
        set((state) => {
          const newVessels = new Map(state.vessels);
          newVessels.set(msg.vessel.mmsi, msg.vessel);
          return { vessels: newVessels, stats: msg.stats };
        });
        break;
      case 'transit':
        set((state) => ({
          transitHistory: [...state.transitHistory.slice(-199), msg.transit],
        }));
        break;
      case 'stats':
        set({ stats: msg.stats });
        break;
    }
  },
}));

// --- WebSocket mode ---
let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

function connectWebSocketMode() {
  const wsBase = API_BASE || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  const url = wsBase.replace(/^http/, 'ws');

  ws = new WebSocket(url);
  ws.onopen = () => {
    console.log('WebSocket connected');
    useStore.getState().setConnected(true);
  };
  ws.onmessage = (event) => {
    try {
      useStore.getState().handleMessage(JSON.parse(event.data) as WSMessage);
    } catch { /* skip */ }
  };
  ws.onclose = () => {
    useStore.getState().setConnected(false);
    reconnectTimeout = setTimeout(connectWebSocketMode, 3000);
  };
  ws.onerror = () => ws?.close();
}

// --- Polling mode ---
let pollInterval: ReturnType<typeof setInterval> | null = null;

async function fetchJSON(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function pollGitHub() {
  try {
    const live = await fetchJSON(`${GITHUB_RAW_BASE}/live/vessels.json`);
    useStore.getState().setLiveData(live.vessels, live.stats, live.recentTransits || [], live.aisHealth);

    const state = useStore.getState();
    if (!state.historicalData || Date.now() - state.lastFetch > 60_000) {
      const history = await fetchJSON(`${GITHUB_RAW_BASE}/history/daily.json`);
      useStore.getState().setHistoricalData(history);
    }
  } catch (err) {
    console.warn('GitHub poll failed:', err);
    useStore.getState().setConnected(false);
  }
}

async function pollAPI() {
  try {
    const live = await fetchJSON(`${API_BASE}/api/live`);
    useStore.getState().setLiveData(live.vessels, live.stats, live.recentTransits || []);

    const state = useStore.getState();
    if (!state.historicalData || Date.now() - state.lastFetch > 60_000) {
      const [dailyStats, transitCounts, topVessels, dbStats] = await Promise.all([
        fetchJSON(`${API_BASE}/api/stats/daily`),
        fetchJSON(`${API_BASE}/api/transits/daily`),
        fetchJSON(`${API_BASE}/api/vessels/top`),
        fetchJSON(`${API_BASE}/api/db/stats`),
      ]);
      useStore.getState().setHistoricalData({ dailyStats, transitCounts, topVessels, dbStats });
    }
  } catch (err) {
    console.warn('API poll failed:', err);
    useStore.getState().setConnected(false);
  }
}

export function connectDataSource() {
  const mode = getDataMode();
  console.log(`Data mode: ${mode}`);

  if (mode === 'ws') {
    connectWebSocketMode();
  } else if (mode === 'github') {
    pollGitHub();
    pollInterval = setInterval(pollGitHub, 15_000);
  } else {
    pollAPI();
    pollInterval = setInterval(pollAPI, 5_000);
  }
}

export function disconnectDataSource() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  if (pollInterval) clearInterval(pollInterval);
  ws?.close();
}
