export interface TrailPoint {
  lat: number;
  lon: number;
  ts: number;
}

/** Raw vessel data as received from the server (no derived fields) */
export interface RawVessel {
  mmsi: string;
  name: string;
  lat: number;
  lon: number;
  speed: number;
  course: number;
  heading: number;
  shipType: number;
  navStatus: number;
  lastUpdate: number;
  flag: string;
  trail: TrailPoint[];
}

/** Enriched vessel with frontend-computed classification fields */
export interface Vessel extends RawVessel {
  shipTypeLabel: string;
  category: string;
  isTanker: boolean;
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

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

export interface OilPrice {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

export type WSMessage =
  | { type: 'snapshot'; vessels: Record<string, RawVessel>; stats?: Stats; transitHistory: Transit[] }
  | { type: 'vessel_update'; vessel: RawVessel; stats?: Stats }
  | { type: 'transit'; transit: Transit }
  | { type: 'stats'; stats: Stats };
