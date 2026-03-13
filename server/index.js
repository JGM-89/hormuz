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

const API_KEY = process.env.AISSTREAM_API_KEY;
const PORT = process.env.PORT || 3001;

// Strait of Hormuz bounding box
const HORMUZ_BBOX = [[54.0, 24.0], [58.5, 27.5]];

const isTanker = (type) => type >= 80 && type <= 89;

// In-memory state
const vessels = new Map();
const transitHistory = [];
let messageCount = 0;
let hourlyMsgCount = 0;
let hourlyEastbound = 0;
let hourlyWestbound = 0;

const TANKER_TYPES = {
  80: 'Tanker', 81: 'Tanker (Hazmat A)', 82: 'Tanker (Hazmat B)',
  83: 'Tanker (Hazmat C)', 84: 'Tanker (Hazmat D)', 85: 'Tanker',
  86: 'Tanker', 87: 'Tanker', 88: 'Tanker', 89: 'Tanker (No info)',
};

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
        stats: getStats(),
        recentTransits: transitHistory.slice(-50),
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
    stats: getStats(),
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

function getStats() {
  const allVessels = [...vessels.values()];
  const moving = allVessels.filter(v => v.speed > 0.5);
  const anchored = allVessels.filter(v => v.speed <= 0.5);
  const avgSpeed = moving.length > 0
    ? moving.reduce((sum, v) => sum + v.speed, 0) / moving.length
    : 0;
  return {
    totalVessels: allVessels.length,
    inTransit: moving.length,
    anchored: anchored.length,
    avgSpeed: Math.round(avgSpeed * 10) / 10,
    messageCount,
    lastUpdate: Date.now(),
  };
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
    aisSocket.send(JSON.stringify({
      APIKey: API_KEY,
      BoundingBoxes: [HORMUZ_BBOX],
      FilterMessageTypes: ['PositionReport'],
    }));
    console.log('Subscribed to Strait of Hormuz bounding box');
  });

  aisSocket.on('message', (data) => {
    try { handleAISMessage(JSON.parse(data.toString())); } catch { /* skip */ }
  });

  aisSocket.on('error', (err) => console.error('AISStream error:', err.message));

  aisSocket.on('close', () => {
    console.log('AISStream disconnected, reconnecting in 5s...');
    reconnectTimer = setTimeout(connectToAISStream, 5000);
  });
}

function handleAISMessage(msg) {
  if (msg.MessageType !== 'PositionReport') return;

  const meta = msg.MetaData;
  const pos = msg.Message?.PositionReport;
  if (!meta || !pos) return;

  const shipType = meta.ShipType ?? pos.Type ?? 0;
  const name = (meta.ShipName || '').trim();
  const isTankerByType = isTanker(shipType);
  const isTankerByName = /tanker|crude|oil|petrol|lng|lpg|vlcc|ulcc|suezmax|aframax/i.test(name);

  if (!isTankerByType && !isTankerByName) return;

  messageCount++;
  hourlyMsgCount++;

  const mmsi = String(meta.MMSI);
  const prevVessel = vessels.get(mmsi);

  const vessel = {
    mmsi,
    name: name || `Unknown (${mmsi})`,
    lat: meta.latitude,
    lon: meta.longitude,
    speed: pos.Sog ?? 0,
    course: pos.Cog ?? 0,
    heading: pos.TrueHeading ?? pos.Cog ?? 0,
    shipType,
    shipTypeLabel: TANKER_TYPES[shipType] || (isTankerByName ? 'Tanker (by name)' : 'Vessel'),
    navStatus: pos.NavigationalStatus ?? -1,
    lastUpdate: Date.now(),
    flag: meta.country ?? '',
    trail: [
      ...(prevVessel?.trail || []).slice(-19),
      { lat: meta.latitude, lon: meta.longitude, ts: Date.now() },
    ],
  };

  vessels.set(mmsi, vessel);
  queuePosition(vessel);

  // Detect strait transit
  if (prevVessel) {
    const crossedEast = prevVessel.lon < 56.5 && vessel.lon >= 56.5;
    const crossedWest = prevVessel.lon > 56.5 && vessel.lon <= 56.5;
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

  broadcast({ type: 'vessel_update', vessel, stats: getStats() });
}

// --- Periodic tasks ---

// Clean stale vessels (30 min)
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [mmsi, vessel] of vessels) {
    if (vessel.lastUpdate < cutoff) vessels.delete(mmsi);
  }
}, 60_000);

// Flush positions to DB every 30s
setInterval(() => flushPositions(), 30_000);

// Update hourly stats every 5 min
setInterval(() => {
  const stats = getStats();
  updateHourlyStats(stats, hourlyEastbound, hourlyWestbound, hourlyMsgCount);
  hourlyEastbound = 0;
  hourlyWestbound = 0;
  hourlyMsgCount = 0;
}, 300_000);

// Push to GitHub every 15s
setInterval(async () => {
  if (!isGitHubConfigured()) return;
  const historicalData = {
    dailyStats: getDailyStats(30),
    transitCounts: getTransitCounts(30),
    topVessels: getTopVessels(30),
    dbStats: getDbStats(),
  };
  await pushSnapshot(vessels, getStats(), transitHistory, historicalData);
}, 15_000);

// Broadcast stats every 10s
setInterval(() => {
  broadcast({ type: 'stats', stats: getStats() });
}, 10_000);

// --- Start ---
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`GitHub push: ${isGitHubConfigured() ? 'enabled (every 15s)' : 'disabled (set GITHUB_TOKEN + GITHUB_REPO)'}`);
  connectToAISStream();
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
