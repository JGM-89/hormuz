import { create } from 'zustand';
import type { Vessel, RawVessel, Transit, Stats, WSMessage, HistoricalData, NewsItem, OilPrice, CommodityData, WeatherState, Aircraft } from './types';
import { enrichVessel } from './utils/ais';

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
  news: NewsItem[];
  oilPrice: OilPrice | null;
  commodities: CommodityData[];
  weather: WeatherState;
  aircraft: Map<string, Aircraft>;
  expandedCommodity: string | null;
  connected: boolean;
  dataMode: 'github' | 'api' | 'ws';
  lastFetch: number;
  setSelectedVessel: (mmsi: string | null) => void;
  handleMessage: (msg: WSMessage) => void;
  setConnected: (connected: boolean) => void;
  setHistoricalData: (data: HistoricalData) => void;
  setAisHealth: (health: AisHealth | null) => void;
  setNews: (news: NewsItem[]) => void;
  setOilPrice: (price: OilPrice | null) => void;
  setCommodities: (data: CommodityData[]) => void;
  setWeather: (data: WeatherState) => void;
  setAircraft: (data: Aircraft[]) => void;
  setExpandedCommodity: (symbol: string | null) => void;
  setLiveData: (vessels: Record<string, RawVessel>, stats: Partial<Stats> | undefined, transits: Transit[], aisHealth?: AisHealth | null) => void;
}

const defaultStats: Stats = {
  totalVessels: 0,
  inTransit: 0,
  anchored: 0,
  avgSpeed: 0,
  messageCount: 0,
  lastUpdate: 0,
};

function computeStats(vessels: Map<string, Vessel>, serverStats?: Partial<Stats>): Stats {
  const all = [...vessels.values()];
  const moving = all.filter(v => v.speed > 0.5);
  const avgSpeed = moving.length > 0
    ? Math.round(moving.reduce((sum, v) => sum + v.speed, 0) / moving.length * 10) / 10
    : 0;
  return {
    totalVessels: all.length,
    inTransit: moving.length,
    anchored: all.length - moving.length,
    avgSpeed,
    messageCount: serverStats?.messageCount ?? 0,
    lastUpdate: Date.now(),
  };
}

function enrichVesselMap(raw: Record<string, RawVessel>): Map<string, Vessel> {
  const map = new Map<string, Vessel>();
  for (const [mmsi, v] of Object.entries(raw)) {
    map.set(mmsi, enrichVessel(v as RawVessel));
  }
  return map;
}

export const useStore = create<AppState>((set) => ({
  vessels: new Map(),
  selectedVessel: null,
  stats: defaultStats,
  transitHistory: [],
  historicalData: null,
  aisHealth: null,
  news: [],
  oilPrice: null,
  commodities: [],
  weather: { current: null, daily: [] },
  aircraft: new Map(),
  expandedCommodity: null,
  connected: false,
  dataMode: getDataMode(),
  lastFetch: 0,

  setSelectedVessel: (mmsi) => set({ selectedVessel: mmsi }),
  setConnected: (connected) => set({ connected }),
  setHistoricalData: (data) => set({ historicalData: data }),
  setAisHealth: (health) => set({ aisHealth: health }),
  setNews: (news) => set({ news }),
  setOilPrice: (price) => set({ oilPrice: price }),
  setCommodities: (data) => set({ commodities: data }),
  setAircraft: (data) => set({ aircraft: new Map(data.map(a => [a.icao24, a])) }),
  setWeather: (data) => set({ weather: data }),
  setExpandedCommodity: (symbol) => set({ expandedCommodity: symbol }),

  setLiveData: (vessels, stats, transits, aisHealth) => {
    const enriched = enrichVesselMap(vessels);
    return set({
      vessels: enriched,
      stats: computeStats(enriched, stats),
      transitHistory: transits,
      aisHealth: aisHealth ?? null,
      lastFetch: Date.now(),
      connected: true,
    });
  },

  handleMessage: (msg) => {
    switch (msg.type) {
      case 'snapshot': {
        const vessels = enrichVesselMap(msg.vessels);
        set({
          vessels,
          stats: computeStats(vessels, msg.stats),
          transitHistory: msg.transitHistory,
        });
        break;
      }
      case 'vessel_update': {
        set((state) => {
          const newVessels = new Map(state.vessels);
          newVessels.set(msg.vessel.mmsi, enrichVessel(msg.vessel));
          return { vessels: newVessels, stats: computeStats(newVessels, msg.stats) };
        });
        break;
      }
      case 'transit':
        set((state) => ({
          transitHistory: [...state.transitHistory.slice(-199), msg.transit],
        }));
        break;
      case 'stats':
        // Legacy: server sends pre-computed stats. Ignore — we compute locally.
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

    // Fetch news + market + commodities (non-blocking, fail silently)
    fetchJSON(`${GITHUB_RAW_BASE}/live/news.json`)
      .then(data => { if (data?.items) useStore.getState().setNews(data.items); })
      .catch(() => {});
    fetchJSON(`${GITHUB_RAW_BASE}/live/market.json`)
      .then(data => { if (data?.price) useStore.getState().setOilPrice(data); })
      .catch(() => {});
    fetchJSON(`${GITHUB_RAW_BASE}/live/commodities.json`)
      .then(data => { if (data?.commodities?.length > 0) useStore.getState().setCommodities(data.commodities); })
      .catch(() => {});
    fetchJSON(`${GITHUB_RAW_BASE}/live/aircraft.json`)
      .then(data => { if (data?.aircraft) useStore.getState().setAircraft(data.aircraft); })
      .catch(() => {});
  } catch (err) {
    console.warn('GitHub poll failed:', err);
    useStore.getState().setConnected(false);
  }
}

async function pollAPI() {
  try {
    const live = await fetchJSON(`${API_BASE}/api/live`);
    useStore.getState().setLiveData(live.vessels, live.stats, live.recentTransits || [], live.aisHealth);

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

    // Fetch commodity prices (non-blocking, fail silently)
    fetchJSON(`${API_BASE}/api/commodities`)
      .then(data => { if (Array.isArray(data) && data.length > 0) useStore.getState().setCommodities(data); })
      .catch(() => {});
    // Fetch aircraft positions (non-blocking, fail silently)
    fetchJSON(`${API_BASE}/api/aircraft`)
      .then(data => { if (Array.isArray(data) && data.length > 0) useStore.getState().setAircraft(data); })
      .catch(() => {});
  } catch (err) {
    console.warn('API poll failed:', err);
    useStore.getState().setConnected(false);
  }
}

// Poll commodity prices from NAS server (works in both WS and API modes)
let commodityPollInterval: ReturnType<typeof setInterval> | null = null;

async function pollCommodities() {
  const base = API_BASE || `${window.location.protocol}//${window.location.host}`;
  try {
    const data = await fetchJSON(`${base}/api/commodities`);
    if (Array.isArray(data) && data.length > 0) {
      useStore.getState().setCommodities(data);
    }
  } catch { /* silent */ }
}

// Poll aircraft positions from NAS server (works in both WS and API modes)
let aircraftPollInterval: ReturnType<typeof setInterval> | null = null;

async function pollAircraft() {
  const base = API_BASE || `${window.location.protocol}//${window.location.host}`;
  try {
    const data = await fetchJSON(`${base}/api/aircraft`);
    if (Array.isArray(data) && data.length > 0) {
      useStore.getState().setAircraft(data);
    }
  } catch { /* silent */ }
}

export function connectDataSource() {
  const mode = getDataMode();
  console.log(`Data mode: ${mode}`);

  if (mode === 'ws') {
    connectWebSocketMode();
    // Also poll commodities + aircraft from the same server
    pollCommodities();
    commodityPollInterval = setInterval(pollCommodities, 5 * 60_000);
    pollAircraft();
    aircraftPollInterval = setInterval(pollAircraft, 30_000);
  } else if (mode === 'github') {
    pollGitHub();
    pollInterval = setInterval(pollGitHub, 60_000);
  } else {
    pollAPI();
    pollInterval = setInterval(pollAPI, 5_000);
    // Commodity polling is handled inside pollAPI, but start initial fetch
    pollCommodities();
    commodityPollInterval = setInterval(pollCommodities, 5 * 60_000);
    pollAircraft();
    aircraftPollInterval = setInterval(pollAircraft, 30_000);
  }
}

export function disconnectDataSource() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  if (pollInterval) clearInterval(pollInterval);
  if (commodityPollInterval) clearInterval(commodityPollInterval);
  if (aircraftPollInterval) clearInterval(aircraftPollInterval);
  ws?.close();
}
