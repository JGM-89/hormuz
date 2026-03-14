# Changelog

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
