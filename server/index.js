import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { config } from 'dotenv';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import {
  queuePosition, flushPositions, recordTransit, updateHourlyStats,
  getDailyStats, getHourlyStats, getRecentTransits, getTransitCounts,
  getTopVessels, getDbStats,
} from './db.js';
import { pushSnapshot, isGitHubConfigured } from './github-push.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

// --- All config from env vars with sensible defaults ---
const API_KEY = process.env.AISSTREAM_API_KEY;
const PORT = process.env.PORT || 3001;
const BOUNDING_BOX = process.env.BOUNDING_BOX
  ? JSON.parse(process.env.BOUNDING_BOX)
  : [[24.0, 54.0], [27.5, 58.5]]; // [lat, lon] — AISStream format
const STALE_MINUTES = parseInt(process.env.STALE_MINUTES || '30', 10);
const MAX_TRAIL_POINTS = parseInt(process.env.MAX_TRAIL_POINTS || '20', 10);
const PUSH_INTERVAL_MS = parseInt(process.env.PUSH_INTERVAL_MS || '60000', 10);
const TRANSIT_LONGITUDE = parseFloat(process.env.TRANSIT_LONGITUDE || '56.5');

// In-memory state
const vessels = new Map();
const transitHistory = [];
let messageCount = 0;
let hourlyMsgCount = 0;
let hourlyEastbound = 0;
let hourlyWestbound = 0;

// AIS connection health tracking
let aisConnectedSince = null;
let lastAisMessage = 0;
let aisReconnects = 0;

function getAisHealth() {
  const now = Date.now();
  const timeSinceLastMsg = lastAisMessage ? now - lastAisMessage : null;
  const connected = aisConnectedSince !== null;
  const connectedFor = connected ? now - aisConnectedSince : 0;

  const receiving = connected && lastAisMessage > 0 && timeSinceLastMsg < 120_000;
  const possibleOutage = connected && connectedFor > 60_000 && !receiving;

  let status = 'connecting';
  if (receiving) status = 'live';
  else if (possibleOutage) status = 'outage';
  else if (connected) status = 'waiting';

  return {
    status,
    connected,
    lastMessage: lastAisMessage || null,
    timeSinceLastMsg,
    reconnects: aisReconnects,
    serverUptime: Math.round(process.uptime()),
  };
}

// Internal stats for DB writes only (not sent to clients)
function getInternalStats() {
  const allVessels = [...vessels.values()];
  const moving = allVessels.filter(v => v.speed > 0.5);
  const avgSpeed = moving.length > 0
    ? moving.reduce((sum, v) => sum + v.speed, 0) / moving.length
    : 0;
  return {
    totalVessels: allVessels.length,
    inTransit: moving.length,
    anchored: allVessels.length - moving.length,
    avgSpeed: Math.round(avgSpeed * 10) / 10,
    messageCount,
    lastUpdate: Date.now(),
  };
}

// --- HTTP server for static files + REST API ---
const distDir = resolve(__dirname, '../dist');

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // REST API endpoints
  if (req.url.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');

    if (req.url === '/api/live') {
      res.end(JSON.stringify({
        vessels: Object.fromEntries(vessels),
        recentTransits: transitHistory.slice(-50),
        aisHealth: getAisHealth(),
        timestamp: Date.now(),
      }));
    } else if (req.url === '/api/stats/daily') {
      res.end(JSON.stringify(getDailyStats(30)));
    } else if (req.url === '/api/stats/hourly') {
      res.end(JSON.stringify(getHourlyStats(48)));
    } else if (req.url === '/api/transits/recent') {
      res.end(JSON.stringify(getRecentTransits(24)));
    } else if (req.url === '/api/transits/daily') {
      res.end(JSON.stringify(getTransitCounts(30)));
    } else if (req.url === '/api/vessels/top') {
      res.end(JSON.stringify(getTopVessels(30)));
    } else if (req.url === '/api/db/stats') {
      res.end(JSON.stringify(getDbStats()));
    } else if (req.url === '/api/commodities') {
      handleCommodities(res);
    } else if (req.url === '/api/health') {
      res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), github: isGitHubConfigured() }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    }
    return;
  }

  // Serve static frontend files (production build)
  if (existsSync(distDir)) {
    let filePath = join(distDir, req.url === '/' ? 'index.html' : req.url);
    if (!existsSync(filePath)) filePath = join(distDir, 'index.html');

    const ext = filePath.split('.').pop();
    const mimeTypes = {
      html: 'text/html', js: 'application/javascript', css: 'text/css',
      json: 'application/json', png: 'image/png', svg: 'image/svg+xml',
      ico: 'image/x-icon', woff2: 'font/woff2',
    };
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    try {
      res.end(readFileSync(filePath));
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.end('<h3>Frontend not built yet. Run <code>npm run build</code> in the project root.</h3>');
  }
});

// --- WebSocket server ---
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Client connected (${clients.size} total)`);

  ws.send(JSON.stringify({
    type: 'snapshot',
    vessels: Object.fromEntries(vessels),
    transitHistory: transitHistory.slice(-100),
  }));

  ws.on('close', () => clients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

// --- AISStream connection ---
let aisSocket = null;
let reconnectTimer = null;

function connectToAISStream() {
  if (!API_KEY) {
    console.error('ERROR: AISSTREAM_API_KEY not set in .env file');
    process.exit(1);
  }

  console.log('Connecting to AISStream.io...');
  aisSocket = new WebSocket('wss://stream.aisstream.io/v0/stream');

  aisSocket.on('open', () => {
    console.log('Connected to AISStream.io');
    aisConnectedSince = Date.now();
    aisSocket.send(JSON.stringify({
      APIKey: API_KEY,
      BoundingBoxes: [BOUNDING_BOX],
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
    }));
    console.log(`Subscribed to bounding box: ${JSON.stringify(BOUNDING_BOX)}`);
  });

  let msgTotal = 0;
  aisSocket.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      lastAisMessage = Date.now();
      msgTotal++;
      if (msgTotal <= 3 || msgTotal % 100 === 0) {
        console.log(`[AIS] msg #${msgTotal} type=${parsed.MessageType} ship=${parsed.MetaData?.ShipName || '?'} shipType=${parsed.MetaData?.ShipType ?? '?'}`);
      }
      handleAISMessage(parsed);
    } catch { /* skip */ }
  });

  aisSocket.on('error', (err) => console.error('AISStream error:', err.message));

  aisSocket.on('close', () => {
    console.log('AISStream disconnected, reconnecting in 5s...');
    aisConnectedSince = null;
    aisReconnects++;
    reconnectTimer = setTimeout(connectToAISStream, 5000);
  });
}

// Track known ship types from static data messages
const knownShipTypes = new Map();

function handleAISMessage(msg) {
  // Store ship type from static data messages
  if (msg.MessageType === 'ShipStaticData') {
    const meta = msg.MetaData;
    const staticData = msg.Message?.ShipStaticData;
    if (meta?.MMSI) {
      const type = staticData?.Type ?? meta.ShipType ?? 0;
      knownShipTypes.set(String(meta.MMSI), type);
    }
    return;
  }

  if (msg.MessageType !== 'PositionReport') return;

  const meta = msg.MetaData;
  const pos = msg.Message?.PositionReport;
  if (!meta || !pos) return;

  const shipType = meta.ShipType ?? knownShipTypes.get(String(meta.MMSI)) ?? pos.Type ?? 0;
  const name = (meta.ShipName || '').trim();

  messageCount++;
  hourlyMsgCount++;

  const mmsi = String(meta.MMSI);
  const prevVessel = vessels.get(mmsi);

  // Raw vessel — no classification, frontend handles that
  const vessel = {
    mmsi,
    name: name || `Unknown (${mmsi})`,
    lat: meta.latitude,
    lon: meta.longitude,
    speed: pos.Sog ?? 0,
    course: pos.Cog ?? 0,
    heading: pos.TrueHeading ?? pos.Cog ?? 0,
    shipType,
    navStatus: pos.NavigationalStatus ?? -1,
    lastUpdate: Date.now(),
    flag: meta.country ?? '',
    trail: [
      ...(prevVessel?.trail || []).slice(-(MAX_TRAIL_POINTS - 1)),
      { lat: meta.latitude, lon: meta.longitude, ts: Date.now() },
    ],
  };

  vessels.set(mmsi, vessel);
  queuePosition(vessel);

  // Detect strait transit (for DB recording)
  if (prevVessel) {
    const crossedEast = prevVessel.lon < TRANSIT_LONGITUDE && vessel.lon >= TRANSIT_LONGITUDE;
    const crossedWest = prevVessel.lon > TRANSIT_LONGITUDE && vessel.lon <= TRANSIT_LONGITUDE;
    if (crossedEast || crossedWest) {
      const transit = {
        mmsi, name: vessel.name,
        direction: crossedEast ? 'eastbound' : 'westbound',
        timestamp: Date.now(), speed: vessel.speed,
      };
      transitHistory.push(transit);
      recordTransit(transit);
      if (crossedEast) hourlyEastbound++;
      else hourlyWestbound++;
      broadcast({ type: 'transit', transit });
    }
  }

  broadcast({ type: 'vessel_update', vessel });
}

// --- Periodic tasks ---

// Clean stale vessels
setInterval(() => {
  const cutoff = Date.now() - STALE_MINUTES * 60 * 1000;
  for (const [mmsi, vessel] of vessels) {
    if (vessel.lastUpdate < cutoff) vessels.delete(mmsi);
  }
}, 60_000);

// Flush positions to DB every 30s
setInterval(() => flushPositions(), 30_000);

// Update hourly stats every 5 min (for historical DB only)
setInterval(() => {
  const stats = getInternalStats();
  updateHourlyStats(stats, hourlyEastbound, hourlyWestbound, hourlyMsgCount);
  hourlyEastbound = 0;
  hourlyWestbound = 0;
  hourlyMsgCount = 0;
}, 300_000);

// Push to GitHub (always push — even with 0 vessels, frontend needs aisHealth + commodities)
setInterval(async () => {
  if (!isGitHubConfigured()) return;
  const historicalData = {
    dailyStats: getDailyStats(30),
    transitCounts: getTransitCounts(30),
    topVessels: getTopVessels(30),
    dbStats: getDbStats(),
  };
  // Include cached commodity data so GitHub Pages gets real prices
  const commodities = commodityCache || [];
  await pushSnapshot(vessels, transitHistory, historicalData, getAisHealth(), commodities);
}, PUSH_INTERVAL_MS);

// --- Commodity Price Proxy ---
const YAHOO_SYMBOLS = ['BZ=F', 'CL=F', 'NG=F', 'TTF=F', 'ALI=F'];
const COMMODITY_META = {
  'BZ=F': { name: 'Brent Crude Oil', shortName: 'BRENT', unit: '$/bbl', sensitivity: 0.95 },
  'CL=F': { name: 'WTI Crude Oil', shortName: 'WTI', unit: '$/bbl', sensitivity: 0.70 },
  'NG=F': { name: 'Natural Gas (Henry Hub)', shortName: 'NATGAS', unit: '$/MMBtu', sensitivity: 0.30 },
  'TTF=F': { name: 'TTF Natural Gas (EU)', shortName: 'TTF', unit: '€/MWh', sensitivity: 0.85 },
  'ALI=F': { name: 'Aluminum', shortName: 'ALUM', unit: '$/mt', sensitivity: 0.15 },
};
const DERIVED_META = {
  'LNG': { name: 'LNG (Asia JKM)', shortName: 'LNG', unit: '$/MMBtu', sensitivity: 0.90, baseSymbol: 'NG=F', multiplier: 3.5, offset: 2.0 },
  'UREA': { name: 'Urea (NOLA)', shortName: 'UREA', unit: '$/mt', sensitivity: 0.60, baseSymbol: 'BZ=F', multiplier: 8.5, offset: 10 },
  'NH3': { name: 'Ammonia (FOB ME)', shortName: 'NH3', unit: '$/mt', sensitivity: 0.75, baseSymbol: 'BZ=F', multiplier: 6.5, offset: 15 },
};

let commodityCache = null;
let commodityCacheTime = 0;
const COMMODITY_CACHE_TTL = 5 * 60_000; // 5 minutes

async function fetchYahooSymbol(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HormuzTracker/1.0)' },
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: ${res.status}`);
  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo ${symbol}: no result`);

  const meta = result.meta;
  const closes = result.indicators?.quote?.[0]?.close || [];
  const timestamps = result.timestamp || [];
  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose || (closes.length >= 2 ? closes[closes.length - 2] : price);
  const open = closes.length > 0 ? closes[closes.length - 1] : price; // today's open approximation
  const dayHigh = meta.regularMarketDayHigh || price;
  const dayLow = meta.regularMarketDayLow || price;
  const change = price - prevClose;
  const changePercent = prevClose ? (change / prevClose) * 100 : 0;

  // Build history from daily closes
  const history = [];
  for (let i = 0; i < closes.length; i++) {
    if (closes[i] != null && timestamps[i]) {
      history.push({ timestamp: timestamps[i] * 1000, price: closes[i] });
    }
  }

  return { price, change, changePercent, open24h: open, high24h: dayHigh, low24h: dayLow, history };
}

function deriveFromBase(baseData, derived) {
  const price = baseData.price * derived.multiplier + derived.offset;
  const prevPrice = (baseData.price - baseData.change) * derived.multiplier + derived.offset;
  const change = price - prevPrice;
  const changePercent = prevPrice ? (change / prevPrice) * 100 : 0;
  const history = baseData.history.map(h => ({
    timestamp: h.timestamp,
    price: h.price * derived.multiplier + derived.offset,
  }));
  const prices = history.map(h => h.price);
  return {
    price: Math.round(price * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    open24h: Math.round((baseData.open24h * derived.multiplier + derived.offset) * 100) / 100,
    high24h: Math.round(Math.max(...prices.slice(-5), price) * 100) / 100,
    low24h: Math.round(Math.min(...prices.slice(-5), price) * 100) / 100,
    history,
  };
}

async function fetchAllCommodities() {
  const now = Date.now();
  if (commodityCache && now - commodityCacheTime < COMMODITY_CACHE_TTL) {
    return commodityCache;
  }

  const results = await Promise.allSettled(
    YAHOO_SYMBOLS.map(s => fetchYahooSymbol(s))
  );

  const commodities = [];
  const fetched = {};

  // Process Yahoo Finance symbols
  for (let i = 0; i < YAHOO_SYMBOLS.length; i++) {
    const symbol = YAHOO_SYMBOLS[i];
    const meta = COMMODITY_META[symbol];
    const result = results[i];

    if (result.status === 'fulfilled') {
      const d = result.value;
      fetched[symbol] = d;
      commodities.push({
        symbol,
        ...meta,
        price: Math.round(d.price * 100) / 100,
        change: Math.round(d.change * 100) / 100,
        changePercent: Math.round(d.changePercent * 100) / 100,
        open24h: Math.round(d.open24h * 100) / 100,
        high24h: Math.round(d.high24h * 100) / 100,
        low24h: Math.round(d.low24h * 100) / 100,
        history: d.history,
        hormuzSensitivity: meta.sensitivity,
      });
    }
  }

  // Process derived commodities
  for (const [symbol, derived] of Object.entries(DERIVED_META)) {
    const baseData = fetched[derived.baseSymbol];
    if (baseData) {
      const d = deriveFromBase(baseData, derived);
      commodities.push({
        symbol,
        name: derived.name,
        shortName: derived.shortName,
        unit: derived.unit,
        ...d,
        hormuzSensitivity: derived.sensitivity,
      });
    }
  }

  if (commodities.length > 0) {
    commodityCache = commodities;
    commodityCacheTime = now;
  }

  return commodities;
}

async function handleCommodities(res) {
  try {
    const data = await fetchAllCommodities();
    res.end(JSON.stringify(data));
  } catch (err) {
    console.error('Commodity fetch error:', err.message);
    // Return cached data if available, even if stale
    if (commodityCache) {
      res.end(JSON.stringify(commodityCache));
    } else {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'Commodity data unavailable' }));
    }
  }
}

// --- Start ---
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Config: bbox=${JSON.stringify(BOUNDING_BOX)} stale=${STALE_MINUTES}m trail=${MAX_TRAIL_POINTS}pts push=${PUSH_INTERVAL_MS}ms transit_lon=${TRANSIT_LONGITUDE}`);
  console.log(`GitHub push: ${isGitHubConfigured() ? `enabled (every ${PUSH_INTERVAL_MS / 1000}s)` : 'disabled (set GITHUB_TOKEN + GITHUB_REPO)'}`);
  connectToAISStream();
  // Pre-fetch commodity prices so they're cached before the first GitHub push
  fetchAllCommodities()
    .then(data => console.log(`[Commodities] Initial fetch: ${data.length} commodities loaded`))
    .catch(err => console.warn(`[Commodities] Initial fetch failed: ${err.message}`));
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  flushPositions();
  if (aisSocket) aisSocket.close();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  wss.close();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM...');
  flushPositions();
  if (aisSocket) aisSocket.close();
  server.close();
  process.exit(0);
});
