import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useStore } from '../store';
import { HORMUZ_CENTER, HORMUZ_ZOOM, TSS_INBOUND, TSS_OUTBOUND, CHOKEPOINT_POLYGON, haversineNm } from '../utils/geo';
import { getSpeedColor } from '../utils/ais';
import { SHIPPING_LANES, EEZ_BOUNDARIES, MILITARY_BASES } from '../utils/overlays';
import type { Vessel } from '../types';

// Free dark tile style (no API key needed)
const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// Shared map ref so LayerToggle can control layers
export const mapInstanceRef: { current: maplibregl.Map | null } = { current: null };

export default function Map() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new globalThis.Map<string, maplibregl.Marker>());
  const vessels = useStore((s) => s.vessels);
  const aircraft = useStore((s) => s.aircraft);
  const setSelectedVessel = useStore((s) => s.setSelectedVessel);

  const handleVesselClick = useCallback(
    (mmsi: string) => {
      setSelectedVessel(mmsi);
    },
    [setSelectedVessel],
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: DARK_STYLE,
      center: HORMUZ_CENTER,
      zoom: HORMUZ_ZOOM,
      pitch: 0,
      bearing: 0,
      minZoom: 5,
      maxZoom: 18,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 200, unit: 'nautical' }),
      'bottom-left',
    );

    // Click on empty map area to deselect vessel
    map.on('click', (e) => {
      // Check if the click hit a vessel marker (DOM markers sit above the canvas)
      const target = e.originalEvent.target as HTMLElement;
      if (target.closest('.vessel-marker')) return;
      useStore.getState().setSelectedVessel(null);
    });

    map.on('load', () => {
      // ─── Satellite raster source (hidden by default, inserted below basemap labels) ───
      map.addSource('satellite-tiles', {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      });

      // Find the first label layer in the basemap so satellite goes underneath it
      const firstLabelLayer = map.getStyle().layers.find(
        (l: { id: string; type: string }) => l.type === 'symbol' && /label|place|poi/i.test(l.id),
      );

      map.addLayer({
        id: 'satellite',
        type: 'raster',
        source: 'satellite-tiles',
        layout: { visibility: 'none' },
        paint: { 'raster-opacity': 0.85 },
      }, firstLabelLayer?.id); // insert below labels so place names stay readable

      // ─── TSS lanes ───
      map.addSource('tss-inbound', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: TSS_INBOUND },
        },
      });
      map.addLayer({
        id: 'tss-inbound',
        type: 'line',
        source: 'tss-inbound',
        layout: { visibility: 'visible' },
        paint: {
          'line-color': '#22d3ee',
          'line-width': 2,
          'line-dasharray': [4, 4],
          'line-opacity': 0.4,
        },
      });

      map.addSource('tss-outbound', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: TSS_OUTBOUND },
        },
      });
      map.addLayer({
        id: 'tss-outbound',
        type: 'line',
        source: 'tss-outbound',
        layout: { visibility: 'visible' },
        paint: {
          'line-color': '#f59e0b',
          'line-width': 2,
          'line-dasharray': [4, 4],
          'line-opacity': 0.4,
        },
      });

      // Chokepoint overlay
      map.addSource('chokepoint', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [CHOKEPOINT_POLYGON] },
        },
      });
      map.addLayer({
        id: 'chokepoint-fill',
        type: 'fill',
        source: 'chokepoint',
        layout: { visibility: 'visible' },
        paint: {
          'fill-color': '#06b6d4',
          'fill-opacity': 0.05,
        },
      });
      map.addLayer({
        id: 'chokepoint-border',
        type: 'line',
        source: 'chokepoint',
        layout: { visibility: 'visible' },
        paint: {
          'line-color': '#06b6d4',
          'line-width': 1,
          'line-opacity': 0.3,
          'line-dasharray': [2, 2],
        },
      });

      // ─── Shipping lanes (on by default) ───
      map.addSource('shipping-lanes', {
        type: 'geojson',
        data: SHIPPING_LANES,
      });
      map.addLayer({
        id: 'shipping-lanes-major',
        type: 'line',
        source: 'shipping-lanes',
        filter: ['==', ['get', 'type'], 'major'],
        layout: { visibility: 'visible' },
        paint: {
          'line-color': '#60a5fa',
          'line-width': 3,
          'line-opacity': 0.6,
        },
      });
      map.addLayer({
        id: 'shipping-lanes-secondary',
        type: 'line',
        source: 'shipping-lanes',
        filter: ['==', ['get', 'type'], 'secondary'],
        layout: { visibility: 'visible' },
        paint: {
          'line-color': '#60a5fa',
          'line-width': 2,
          'line-opacity': 0.45,
          'line-dasharray': [6, 3],
        },
      });

      // ─── EEZ boundaries (on by default) ───
      map.addSource('eez', {
        type: 'geojson',
        data: EEZ_BOUNDARIES,
      });
      map.addLayer({
        id: 'eez-lines',
        type: 'line',
        source: 'eez',
        layout: { visibility: 'visible' },
        paint: {
          'line-color': '#c084fc',
          'line-width': 2,
          'line-opacity': 0.5,
          'line-dasharray': [4, 4],
        },
      });

      // ─── Military bases (on by default) ───
      map.addSource('military-bases', {
        type: 'geojson',
        data: MILITARY_BASES,
      });
      map.addLayer({
        id: 'military-bases-circles',
        type: 'circle',
        source: 'military-bases',
        layout: { visibility: 'visible' },
        paint: {
          'circle-radius': 8,
          'circle-color': [
            'match', ['get', 'country'],
            'IR', '#ef4444',
            'US/BH', '#3b82f6',
            'US/QA', '#3b82f6',
            'US/AE', '#3b82f6',
            'UK/BH', '#22d3ee',
            'UK/OM', '#22d3ee',
            'AE', '#10b981',
            '#f59e0b',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0a1628',
          'circle-opacity': 0.85,
        },
      });
      map.addLayer({
        id: 'military-bases-labels',
        type: 'symbol',
        source: 'military-bases',
        layout: {
          visibility: 'visible',
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        },
        paint: {
          'text-color': '#e2e8f0',
          'text-halo-color': '#0a1628',
          'text-halo-width': 1,
        },
      });

      // ─── Aircraft layer (hidden by default) ───
      // Create plane icon (triangle pointing up, rotated by heading)
      const size = 24;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      // Draw a simple plane shape
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(size / 2, 2);           // nose
      ctx.lineTo(size - 2, size - 4);    // right wing tip
      ctx.lineTo(size / 2, size - 8);    // tail center
      ctx.lineTo(2, size - 4);           // left wing tip
      ctx.closePath();
      ctx.fill();
      // Fuselage line
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(size / 2, size - 8);
      ctx.lineTo(size / 2, size - 2);
      ctx.stroke();

      const imageData = ctx.getImageData(0, 0, size, size);
      map.addImage('plane-icon', imageData, { sdf: false });

      map.addSource('aircraft', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'aircraft-icons',
        type: 'symbol',
        source: 'aircraft',
        layout: {
          visibility: 'visible',
          'icon-image': 'plane-icon',
          'icon-size': 0.8,
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
        },
      });

      // Aircraft hover popup
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 15,
        className: 'vessel-popup',
      });

      map.on('mouseenter', 'aircraft-icons', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties!;
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        const altFt = Math.round((p.altitude || 0) * 3.281);
        const spdKn = Math.round((p.velocity || 0) * 1.944);
        popup.setLngLat(coords).setHTML(`
          <div style="font-family: monospace; font-size: 11px; color: #e2e8f0;">
            <strong>${p.callsign || p.icao24}</strong><br/>
            ${altFt.toLocaleString()} ft · ${spdKn} kn<br/>
            <span style="color: #94a3b8;">${p.originCountry}</span>
          </div>
        `).addTo(map);
      });

      map.on('mouseleave', 'aircraft-icons', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });

      // Vessel trail source and layers
      map.addSource('vessel-trail', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'vessel-trail-line',
        type: 'line',
        source: 'vessel-trail',
        paint: {
          'line-color': ['case',
            ['has', 'speed'],
            ['interpolate', ['linear'], ['get', 'speed'],
              0, '#64748b',
              5, '#22d3ee',
              10, '#10b981',
              16, '#f59e0b',
            ],
            '#22d3ee',
          ],
          'line-width': 3,
          'line-opacity': ['get', 'opacity'],
        },
      });

      // Signal that all overlay layers are ready for LayerToggle to restore persisted state
      map.fire('layers-ready');
    });

    mapRef.current = map;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      mapInstanceRef.current = null;
    };
  }, []);

  // Update aircraft GeoJSON when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('aircraft') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const features: GeoJSON.Feature[] = [];
    aircraft.forEach((a) => {
      features.push({
        type: 'Feature',
        properties: {
          icao24: a.icao24,
          callsign: a.callsign?.trim() || a.icao24,
          originCountry: a.originCountry,
          altitude: a.altitude,
          velocity: a.velocity,
          heading: a.heading || 0,
        },
        geometry: {
          type: 'Point',
          coordinates: [a.lon, a.lat],
        },
      });
    });

    source.setData({ type: 'FeatureCollection', features });
  }, [aircraft]);

  // Fly to vessel + show trail when selected
  const selectedVessel = useStore((s) => s.selectedVessel);
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Fly to vessel when newly selected (not on every vessels update)
    if (selectedVessel && selectedVessel !== prevSelectedRef.current) {
      const vessel = vessels.get(selectedVessel);
      if (vessel) {
        map.flyTo({
          center: [vessel.lon, vessel.lat],
          zoom: Math.max(map.getZoom(), 10),
          duration: 1200,
        });
      }
    }
    prevSelectedRef.current = selectedVessel;

    // Update trail
    const source = map.getSource('vessel-trail') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (!selectedVessel) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const vessel = vessels.get(selectedVessel);
    if (!vessel || !vessel.trail || vessel.trail.length < 2) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    // Build segments colored by speed with opacity gradient
    const features = buildTrailFeatures(vessel);
    source.setData({ type: 'FeatureCollection', features });
  }, [selectedVessel, vessels]);

  // Update vessel markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentMMSIs = new Set<string>();

    vessels.forEach((vessel, mmsi) => {
      currentMMSIs.add(mmsi);
      const existing = markersRef.current.get(mmsi);

      if (existing) {
        existing.setLngLat([vessel.lon, vessel.lat]);
        const el = existing.getElement();
        const arrow = el.querySelector('.vessel-arrow') as HTMLElement;
        if (arrow) {
          arrow.style.transform = `rotate(${vessel.heading}deg)`;
          arrow.style.borderBottomColor = getSpeedColor(vessel.speed);
        }
      } else {
        const el = document.createElement('div');
        el.className = 'vessel-marker';
        el.style.cursor = 'pointer';
        el.innerHTML = `
          <div class="vessel-arrow" style="
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-bottom: 16px solid ${getSpeedColor(vessel.speed)};
            transform: rotate(${vessel.heading}deg);
            filter: drop-shadow(0 0 4px ${getSpeedColor(vessel.speed)}80);
            transition: transform 2s ease, border-bottom-color 2s ease;
          "></div>
        `;

        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 15,
          className: 'vessel-popup',
        }).setHTML(`
          <div style="font-family: monospace; font-size: 11px; color: #e2e8f0;">
            <strong>${vessel.name}</strong><br/>
            ${vessel.speed.toFixed(1)} kn · ${vessel.course.toFixed(0)}°
          </div>
        `);

        el.addEventListener('mouseenter', () => {
          popup.setLngLat([vessel.lon, vessel.lat]).addTo(map);
        });
        el.addEventListener('mouseleave', () => popup.remove());
        el.addEventListener('click', () => handleVesselClick(mmsi));

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([vessel.lon, vessel.lat])
          .addTo(map);

        markersRef.current.set(mmsi, marker);
      }
    });

    // Remove stale markers
    for (const [mmsi, marker] of markersRef.current) {
      if (!currentMMSIs.has(mmsi)) {
        marker.remove();
        markersRef.current.delete(mmsi);
      }
    }
  }, [vessels, handleVesselClick]);

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
}

function buildTrailFeatures(vessel: Vessel): GeoJSON.Feature[] {
  const { trail } = vessel;
  const features: GeoJSON.Feature[] = [];

  for (let i = 1; i < trail.length; i++) {
    const p0 = trail[i - 1];
    const p1 = trail[i];
    const dist = haversineNm(p0.lat, p0.lon, p1.lat, p1.lon);
    const hours = (p1.ts - p0.ts) / 3600000;
    const speed = hours > 0 ? Math.min(dist / hours, 30) : 0;
    const opacity = 0.2 + 0.8 * (i / trail.length); // fade from dim to bright

    features.push({
      type: 'Feature',
      properties: { speed, opacity },
      geometry: {
        type: 'LineString',
        coordinates: [[p0.lon, p0.lat], [p1.lon, p1.lat]],
      },
    });
  }

  return features;
}
