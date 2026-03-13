import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || resolve(__dirname, '../data/hormuz.db');

// Ensure data directory exists
import { mkdirSync } from 'fs';
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read/write performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS vessel_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mmsi TEXT NOT NULL,
    name TEXT,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    speed REAL,
    course REAL,
    heading REAL,
    ship_type INTEGER,
    ship_type_label TEXT,
    nav_status INTEGER,
    flag TEXT,
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mmsi TEXT NOT NULL,
    name TEXT,
    direction TEXT NOT NULL,
    speed REAL,
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS hourly_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hour INTEGER NOT NULL UNIQUE,
    total_vessels INTEGER,
    in_transit INTEGER,
    anchored INTEGER,
    avg_speed REAL,
    eastbound_transits INTEGER DEFAULT 0,
    westbound_transits INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_positions_mmsi ON vessel_positions(mmsi);
  CREATE INDEX IF NOT EXISTS idx_positions_ts ON vessel_positions(timestamp);
  CREATE INDEX IF NOT EXISTS idx_transits_ts ON transits(timestamp);
  CREATE INDEX IF NOT EXISTS idx_hourly_hour ON hourly_stats(hour);
`);

// Prepared statements
const insertPosition = db.prepare(`
  INSERT INTO vessel_positions (mmsi, name, lat, lon, speed, course, heading, ship_type, ship_type_label, nav_status, flag, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertTransit = db.prepare(`
  INSERT INTO transits (mmsi, name, direction, speed, timestamp)
  VALUES (?, ?, ?, ?, ?)
`);

const upsertHourlyStat = db.prepare(`
  INSERT INTO hourly_stats (hour, total_vessels, in_transit, anchored, avg_speed, eastbound_transits, westbound_transits, message_count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(hour) DO UPDATE SET
    total_vessels = excluded.total_vessels,
    in_transit = excluded.in_transit,
    anchored = excluded.anchored,
    avg_speed = excluded.avg_speed,
    eastbound_transits = hourly_stats.eastbound_transits + excluded.eastbound_transits,
    westbound_transits = hourly_stats.westbound_transits + excluded.westbound_transits,
    message_count = hourly_stats.message_count + excluded.message_count
`);

// Batch insert positions (called periodically, not per-message)
const positionBatch = [];
const BATCH_SIZE = 50;

export function queuePosition(vessel) {
  positionBatch.push(vessel);
  if (positionBatch.length >= BATCH_SIZE) {
    flushPositions();
  }
}

export function flushPositions() {
  if (positionBatch.length === 0) return;
  const insertMany = db.transaction((batch) => {
    for (const v of batch) {
      insertPosition.run(v.mmsi, v.name, v.lat, v.lon, v.speed, v.course, v.heading, v.shipType, v.shipTypeLabel, v.navStatus, v.flag, v.lastUpdate);
    }
  });
  insertMany(positionBatch);
  positionBatch.length = 0;
}

export function recordTransit(transit) {
  insertTransit.run(transit.mmsi, transit.name, transit.direction, transit.speed, transit.timestamp);
}

export function updateHourlyStats(stats, eastbound, westbound, msgCount) {
  const hour = Math.floor(Date.now() / 3600000) * 3600000;
  upsertHourlyStat.run(hour, stats.totalVessels, stats.inTransit, stats.anchored, stats.avgSpeed, eastbound, westbound, msgCount);
}

// Query functions for historical data
export function getDailyStats(days = 30) {
  const since = Date.now() - days * 86400000;
  return db.prepare(`
    SELECT
      (hour / 86400000) * 86400000 as day,
      MAX(total_vessels) as peak_vessels,
      ROUND(AVG(avg_speed), 1) as avg_speed,
      SUM(eastbound_transits) as eastbound,
      SUM(westbound_transits) as westbound,
      SUM(message_count) as messages
    FROM hourly_stats
    WHERE hour >= ?
    GROUP BY day
    ORDER BY day
  `).all(since);
}

export function getHourlyStats(hours = 48) {
  const since = Date.now() - hours * 3600000;
  return db.prepare(`
    SELECT * FROM hourly_stats WHERE hour >= ? ORDER BY hour
  `).all(since);
}

export function getRecentTransits(hours = 24) {
  const since = Date.now() - hours * 3600000;
  return db.prepare(`
    SELECT * FROM transits WHERE timestamp >= ? ORDER BY timestamp DESC
  `).all(since);
}

export function getTransitCounts(days = 30) {
  const since = Date.now() - days * 86400000;
  return db.prepare(`
    SELECT
      (timestamp / 86400000) * 86400000 as day,
      SUM(CASE WHEN direction = 'eastbound' THEN 1 ELSE 0 END) as eastbound,
      SUM(CASE WHEN direction = 'westbound' THEN 1 ELSE 0 END) as westbound,
      COUNT(*) as total
    FROM transits
    WHERE timestamp >= ?
    GROUP BY day
    ORDER BY day
  `).all(since);
}

export function getTopVessels(days = 30, limit = 20) {
  const since = Date.now() - days * 86400000;
  return db.prepare(`
    SELECT mmsi, name, COUNT(*) as transit_count, flag
    FROM transits
    WHERE timestamp >= ?
    GROUP BY mmsi
    ORDER BY transit_count DESC
    LIMIT ?
  `).all(since, limit);
}

export function getDbStats() {
  const posCount = db.prepare('SELECT COUNT(*) as count FROM vessel_positions').get();
  const transitCount = db.prepare('SELECT COUNT(*) as count FROM transits').get();
  const hourlyCount = db.prepare('SELECT COUNT(*) as count FROM hourly_stats').get();
  const oldestPos = db.prepare('SELECT MIN(timestamp) as ts FROM vessel_positions').get();
  return {
    positions: posCount.count,
    transits: transitCount.count,
    hourlyRecords: hourlyCount.count,
    oldestRecord: oldestPos.ts || null,
  };
}

// Flush on exit
process.on('exit', () => {
  flushPositions();
  db.close();
});

export default db;
