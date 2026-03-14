# Hormuz Tracker

Real-time vessel tracking dashboard for the Strait of Hormuz, one of the world's most critical oil transit chokepoints.

**Live demo:** [jgm-89.github.io/hormuz](https://jgm-89.github.io/hormuz/)

## Features

- Live AIS vessel tracking via [AISStream.io](https://aisstream.io) WebSocket feed
- Interactive map with vessel trails (MapLibre GL JS, dark basemap)
- Vessel category filters (tankers, cargo, passenger, etc.)
- Strait congestion monitoring with eastbound/westbound transit counts
- Speed anomaly detection
- Brent crude oil price widget
- Strait weather conditions (wind, waves, temperature via Open-Meteo)
- Maritime news ticker (Google News, gCaptain, Maritime Executive)
- Analytics modal with historical charts
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

```bash
# Build the image
docker build -t hormuz-tracker .

# Export for NAS
docker save hormuz-tracker -o hormuz-tracker.tar

# Copy .tar to NAS → import via Synology Container Manager
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AIS_API_KEY` | — | AISStream.io API key (required) |
| `PORT` | `3001` | Server port |
| `DB_PATH` | `./data/hormuz.db` | SQLite database path |
| `BOUNDING_BOX` | `[[54.0,24.0],[58.5,27.5]]` | AIS geographic filter (JSON) |
| `STALE_MINUTES` | `30` | Remove vessels not seen in N minutes |
| `MAX_TRAIL_POINTS` | `20` | Max trail points per vessel |
| `PUSH_INTERVAL_MS` | `60000` | GitHub snapshot push interval |
| `TRANSIT_LONGITUDE` | `56.5` | Longitude line for transit detection |
| `GITHUB_TOKEN` | — | GitHub PAT for data branch pushes |
| `GITHUB_OWNER` | — | GitHub repo owner |
| `GITHUB_REPO` | — | GitHub repo name |

## License

[MIT](LICENSE)
