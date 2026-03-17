# Changelog

## [0.9.0] - 2026-03-17

### Added
- Aircraft detail panel — click any aircraft in the list to see altitude, flight level, speed, heading, origin country, and external tracking links (FlightRadar24, ADS-B Exchange)
- Aircraft fly-to — clicking an aircraft pans the map to its position
- `deploy-nas.bat` — one-click Docker build script that saves env vars to `.env.nas` and generates `hormuz-compose.yml` for Synology Container Manager

### Changed
- Map default centre adjusted from strait-only to wider UAE coast + strait view so vessel markers are visible on initial load
- AIS speed cap lowered from 50 kn to 30 kn (both server and client) to filter corrupt ~48.5 kn readings from faulty AISStream shore stations
- Selecting an aircraft deselects any selected vessel and vice versa

## [0.8.0] - 2026-03-16

### Added
- Aircraft tracking panel in left sidebar (tab bar: Vessels / Aircraft)
- Aircraft list with search, sort by callsign/altitude/speed, military callsign detection
- Ship type inference from vessel names (tanker, cargo, tug, military, etc.) when AIS type data is 0
- Position validation — filters vessels with invalid or out-of-region coordinates
- Separate volume sliders for ambience and VHF radio
- ESRI satellite imagery layer (inserted below basemap labels for readability)
- All map layers on by default except satellite, with localStorage persistence
- Custom `layers-ready` event to fix layer toggle restore race condition

### Changed
- Sonar ping merged into ocean ambience toggle (no longer separate control)
- Speed anomaly detection now flags >25 kn only (was flagging slow + fast)
- Stats bar transit count uses inline styles for readability (was unreadable with Tailwind text-accent)
- Forecast issued time uses explicit UTC hours/minutes (was showing invalid "29:45 UTC")

### Fixed
- Layer toggles not working on first page load (layers-ready event race condition)
- Satellite imagery rendering on top of place name labels
- Vessels appearing on land in clusters (corrupt AIS positions filtered)
- "Everything moving fast" display issue (corrupt ~48.5 kn speeds from shore stations)

## [0.7.0] - 2026-03-14

### Added
- Shipping forecast — BBC-style text readout generated from live weather data
- Spoken shipping forecast via Web Speech API (British English voice, every 30 min)
- Forecast toggle + "Speak Now" button in audio settings panel
- Shipping forecast section in sidebar Charts tab and expanded intelligence report

## [0.6.0] - 2026-03-14

### Added
- VHF feed selector dropdown in audio settings (7 streams: NW Ireland, Vlissingen, Netherlands CG, etc.)
- UK/Irish Sea and North Sea entrance streams as top-priority feeds
- Stream selection persists across page reloads

### Changed
- Reduced procedural ambient volume (ocean, static, sonar) by 80%
- Radio layer supports forced stream index with fallback cascade

## [0.5.0] - 2026-03-14

### Added
- Full intelligence report with 2-column dashboard layout (Expand view)
- 5 rule-based analysis generators (executive summary, traffic, market, weather, anomaly)
- Shared mock commodity data for development without backend
- Commodity risk premium calculation and Hormuz sensitivity scoring

### Changed
- Intelligence report fills entire viewport with independently scrolling columns
- News ticker search updated from geopolitical to economic/commodity terms
- Anomaly messaging now honest when no AIS data is connected

### Fixed
- VHF radio getting stuck on US fallback stream
- Misleading "strait operating normally" when no data available

## [0.4.0] - 2026-03-14

### Added
- Procedural ocean ambience (pink noise + VHF static hiss)
- Sonar ping layer (periodic sine tone with exponential decay)
- Live marine VHF radio via Broadcastify streams (auto-cascade)
- Audio controller with per-layer toggles and master volume
- Trader-grade commodity panel with 8 commodities and sparkline charts
- Weather panel with Beaufort scale, passage risk, 5-day forecast
- V0 visual polish pass

### Changed
- 3-column command centre layout (vessels, map, analytics)
- Analytics sidebar with Charts/Alerts tabs

## [0.3.0] - 2026-03-14

### Changed
- Refactored layout from absolute positioning to zone-based flex system
- Removed Key Landmarks section from chokepoint overlay

## [0.2.0] - 2026-03-14

### Changed
- Refactored server to "dumb pipe" — all vessel classification, stats computation, and data enrichment now handled client-side
- Server config fully driven by environment variables (no Docker rebuilds for tuning)
- Removed server-side RSS and market data endpoints (fetched client-side)

### Added
- Frontend vessel category filters (Tankers, Cargo, Passenger, Other)
- Client-side weather via Open-Meteo API
- Client-side news via rss2json proxy
- Client-side oil price via Yahoo Finance API
- AIS health status tracking and display

## [0.1.0] - 2026-03-13

### Added
- Initial release with live AIS vessel tracking via AISStream.io
- MapLibre GL JS map with dark basemap
- Real-time WebSocket vessel updates
- Vessel detail panel with trail visualization
- Floating stats bar, congestion overlay, speed anomaly alerts
- News ticker with RSS feeds
- Analytics modal with Recharts
- GitHub Pages deployment
- Docker image for Synology NAS server
