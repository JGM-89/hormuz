# Hormuz Tracker

Real-time vessel tracking dashboard for the Strait of Hormuz, one of the world's most critical oil transit chokepoints.

**Live demo:** [jgm-89.github.io/hormuz](https://jgm-89.github.io/hormuz/)

## Features

### Vessel Tracking
- Live AIS vessel tracking via [AISStream.io](https://aisstream.io) WebSocket feed
- Interactive map with vessel trails (MapLibre GL JS, dark basemap)
- Click-to-select vessels with fly-to and detail panel (speed, course, heading, transit progress, nearby vessels)
- Vessel category filters (tankers, cargo, passenger, etc.)
- Ship type inference from vessel names when AIS type data is missing
- Strait congestion monitoring with eastbound/westbound transit counts
- Speed anomaly detection (>25 kn) with AIS speed cap at 30 kn to filter corrupt shore station data
- Position validation — filters invalid coordinates and out-of-region vessels

### Aircraft Tracking
- Live aircraft tracking via [OpenSky Network](https://opensky-network.org/) API
- Aircraft list with search, sort by callsign/altitude/speed
- Click-to-select with fly-to and detail panel (altitude, flight level, speed, heading, origin country)
- Military callsign detection (RCH, REACH, NAVY, etc.) with MIL badge
- Altitude colour coding (amber < 1000m, cyan < 5000m, purple high altitude)
- External tracking links (FlightRadar24, ADS-B Exchange)

### Intelligence Report
- Full-screen 2-column intelligence report (Expand view)
- 5 rule-based analysis generators producing natural language from live data
- Executive summary, traffic analysis, market analysis, weather assessment, anomaly analysis
- Historical trend comparison with 30-day averages

### Commodity & Market Data
- 8 commodity price trackers (Brent, WTI, Natural Gas, TTF, LNG, Urea, Aluminium, Ammonia)
- Hormuz sensitivity scoring per commodity
- Risk premium calculation based on strait conditions
- Sparkline price charts with change indicators

### Maritime Weather
- Real-time wind, waves, visibility, Beaufort scale (Open-Meteo API)
- Passage risk assessment (low/moderate/high/severe)
- 5-day forecast with per-day risk indicators
- BBC-style shipping forecast text display

### Audio System
- Procedural ocean ambience (pink noise bed + VHF static hiss + sonar ping)
- Ambience volume slider (ocean + sonar combined)
- Live marine VHF radio (7 Broadcastify streams, auto-cascade with manual selector)
- VHF radio volume slider (independent of ambience)
- Spoken shipping forecast via Web Speech API (British English, every 30 minutes)
- Per-layer toggle controls with master volume

### Map Layers
- Traffic separation scheme (TSS) inbound/outbound lanes
- Exclusive Economic Zone (EEZ) boundaries
- Military base markers
- ESRI satellite imagery (below place name labels for readability)
- All layers on by default except satellite, with persisted toggle state

### News & Data
- Maritime news ticker (Google News commodity/shipping search, gCaptain, Maritime Executive)
- GitHub Pages frontend with data snapshots pushed to `data` branch

## Architecture

```
┌─────────────────────────────────────┐
│  Frontend (React + Vite)            │
│  - All vessel classification        │
│  - Stats computation                │
│  - Weather, news, oil price APIs    │
│  Hosted on GitHub Pages             │
└──────────────┬──────────────────────┘
               │ WebSocket
┌──────────────▼──────────────────────┐
│  Server ("dumb pipe")               │
│  - Relays raw AIS data              │
│  - Trail tracking                   │
│  - Transit detection                │
│  - SQLite for historical data       │
│  - Pushes snapshots to GitHub       │
│  Runs in Docker on Synology NAS     │
└─────────────────────────────────────┘
```

The server is intentionally minimal — it relays raw AIS messages and the frontend handles all enrichment (ship type classification, category assignment, stats). This means server-side changes rarely require a Docker rebuild.

## Tech Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, Zustand, Recharts |
| Map      | MapLibre GL JS with CARTO dark basemap |
| Audio    | Web Audio API (procedural), HTML5 Audio (VHF streams), Web Speech API (forecast) |
| Server   | Node.js, WebSocket (ws), better-sqlite3 |
| Deploy   | GitHub Pages (frontend), Docker on Synology NAS (server) |

## Getting Started

### Frontend (dev)

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Without the server running, the UI will show "Waiting for AIS data" but weather, news, and oil price widgets will still populate.

### Server

```bash
cd server
npm install
cp ../.env.example .env  # add your AIS_API_KEY
npm start
```

### Docker (NAS deployment)

Use the one-click deploy script (saves env vars for future builds):

```bash
# Windows — double-click or run:
deploy-nas.bat

# Outputs hormuz.tar + hormuz-compose.yml in the project folder
# Copy both to NAS → import via Synology Container Manager
```

Or build manually:

```bash
docker build -t hormuz-tracker .
docker save hormuz-tracker -o hormuz.tar
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AISSTREAM_API_KEY` | — | AISStream.io API key (required) |
| `PORT` | `3001` | Server port |
| `DB_PATH` | `./data/hormuz.db` | SQLite database path |
| `BOUNDING_BOX` | `[[54.0,24.0],[58.5,27.5]]` | AIS geographic filter (JSON) |
| `STALE_MINUTES` | `30` | Remove vessels not seen in N minutes |
| `MAX_TRAIL_POINTS` | `20` | Max trail points per vessel |
| `PUSH_INTERVAL_MS` | `60000` | GitHub snapshot push interval |
| `TRANSIT_LONGITUDE` | `56.5` | Longitude line for transit detection |
| `GITHUB_TOKEN` | — | GitHub PAT for data branch pushes |
| `GITHUB_REPO` | — | GitHub repo (owner/name format) |
| `GITHUB_DATA_BRANCH` | `data` | Branch for data snapshots |
| `OPENSKY_CLIENT_ID` | — | OpenSky Network OAuth client ID |
| `OPENSKY_CLIENT_SECRET` | — | OpenSky Network OAuth client secret |

## License

[MIT](LICENSE)
