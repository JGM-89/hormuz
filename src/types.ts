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

// Commodity price types
export interface CommodityPricePoint {
  timestamp: number;
  price: number;
}

export interface CommodityData {
  symbol: string;
  name: string;
  shortName: string;
  unit: string;
  price: number;
  change: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  open24h: number;
  history: CommodityPricePoint[];
  hormuzSensitivity: number;
}

// Weather types
export interface WeatherCurrent {
  windSpeed: number;
  windDir: number;
  windGusts: number;
  temp: number;
  waveHeight: number;
  visibility: number;
  beaufort: number;
  beaufortLabel: string;
  passageRisk: 'low' | 'moderate' | 'high' | 'severe';
  updatedAt: number;
}

export interface WeatherForecastDay {
  date: string;
  label: string;
  windSpeedMax: number;
  windGustsMax: number;
  waveHeightMax: number;
  tempMin: number;
  tempMax: number;
  beaufortMax: number;
  passageRisk: 'low' | 'moderate' | 'high' | 'severe';
}

export interface WeatherState {
  current: WeatherCurrent | null;
  daily: WeatherForecastDay[];
}

export interface Aircraft {
  icao24: string;
  callsign: string;
  originCountry: string;
  lat: number;
  lon: number;
  altitude: number;
  velocity: number;
  heading: number;
  onGround: boolean;
  category: number;
}

export type WSMessage =
  | { type: 'snapshot'; vessels: Record<string, RawVessel>; stats?: Stats; transitHistory: Transit[] }
  | { type: 'vessel_update'; vessel: RawVessel; stats?: Stats }
  | { type: 'transit'; transit: Transit }
  | { type: 'stats'; stats: Stats };
