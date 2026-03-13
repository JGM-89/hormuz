import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useStore } from '../store';
import { HORMUZ_CENTER, HORMUZ_ZOOM, TSS_INBOUND, TSS_OUTBOUND, CHOKEPOINT_POLYGON } from '../utils/geo';
import { getSpeedColor } from '../utils/ais';

// Free dark tile style (no API key needed)
const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export default function Map() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new globalThis.Map<string, maplibregl.Marker>());
  const vessels = useStore((s) => s.vessels);
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
      maxZoom: 15,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 200, unit: 'nautical' }),
      'bottom-right',
    );

    map.on('load', () => {
      // Add TSS lanes
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
        paint: {
          'fill-color': '#06b6d4',
          'fill-opacity': 0.05,
        },
      });
      map.addLayer({
        id: 'chokepoint-border',
        type: 'line',
        source: 'chokepoint',
        paint: {
          'line-color': '#06b6d4',
          'line-width': 1,
          'line-opacity': 0.3,
          'line-dasharray': [2, 2],
        },
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
