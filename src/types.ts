export interface TrailPoint {
  lat: number;
  lon: number;
  ts: number;
}

export interface Vessel {
  mmsi: string;
  name: string;
  lat: number;
  lon: number;
  speed: number;
  course: number;
  heading: number;
  shipType: number;
  shipTypeLabel: string;
  navStatus: number;
  lastUpdate: number;
  flag: string;
  trail: TrailPoint[];
}

export interface Transit {
  mmsi: string;
  name: string;
  direction: 'eastbound' | 'westbound';
  timestamp: number;
  speed: number;
}

export interface Stats {
  totalVessels: number;
  inTransit: number;
  anchored: number;
  avgSpeed: number;
  messageCount: number;
  lastUpdate: number;
}

export interface DailyStat {
  day: number;
  peak_vessels: number;
  avg_speed: number;
  eastbound: number;
  westbound: number;
  messages: number;
}

export interface TransitCount {
  day: number;
  eastbound: number;
  westbound: number;
  total: number;
}

export interface TopVessel {
  mmsi: string;
  name: string;
  transit_count: number;
  flag: string;
}

export interface HistoricalData {
  dailyStats: DailyStat[];
  transitCounts: TransitCount[];
  topVessels: TopVessel[];
  dbStats: { positions: number; transits: number; hourlyRecords: number; oldestRecord: number | null };
}

export type WSMessage =
  | { type: 'snapshot'; vessels: Record<string, Vessel>; stats: Stats; transitHistory: Transit[] }
  | { type: 'vessel_update'; vessel: Vessel; stats: Stats }
  | { type: 'transit'; transit: Transit }
  | { type: 'stats'; stats: Stats };
