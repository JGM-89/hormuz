import { useState, useEffect, useRef } from 'react';
import { Layers, Plane, Ship, Shield, Satellite, MapPin } from 'lucide-react';
import { mapInstanceRef } from './Map';
import { getShippingLanes, getEEZBoundaries, getMilitaryBases } from '../utils/overlays';
import { useStore } from '../store';
import type maplibregl from 'maplibre-gl';

interface LayerConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  mapLayers: string[];
  loader?: () => Promise<{ source: string; data: GeoJSON.FeatureCollection }>;
}

const LAYERS: LayerConfig[] = [
  {
    id: 'aircraft',
    label: 'Aircraft',
    icon: <Plane size={14} />,
    mapLayers: ['aircraft-icons'],
  },
  {
    id: 'shipping-lanes',
    label: 'Shipping Lanes',
    icon: <Ship size={14} />,
    mapLayers: ['shipping-lanes-major', 'shipping-lanes-secondary'],
    loader: async () => ({ source: 'shipping-lanes', data: await getShippingLanes() }),
  },
  {
    id: 'military-bases',
    label: 'Military Bases',
    icon: <Shield size={14} />,
    mapLayers: ['military-bases-circles', 'military-bases-labels'],
    loader: async () => ({ source: 'military-bases', data: await getMilitaryBases() }),
  },
  {
    id: 'satellite',
    label: 'Satellite',
    icon: <Satellite size={14} />,
    mapLayers: ['satellite'],
  },
  {
    id: 'eez',
    label: 'EEZ Boundaries',
    icon: <MapPin size={14} />,
    mapLayers: ['eez-lines'],
    loader: async () => ({ source: 'eez', data: await getEEZBoundaries() }),
  },
];

const STORAGE_KEY = 'hormuz-layers';

function loadPersistedState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function persistState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

/** Load data into a map source and set layer visibility — pure map manipulation, no React state */
async function activateLayer(map: maplibregl.Map, layer: LayerConfig, loadedSet: Set<string>) {
  if (layer.loader && !loadedSet.has(layer.id)) {
    try {
      const { source, data } = await layer.loader();
      const src = map.getSource(source) as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(data);
      loadedSet.add(layer.id);
    } catch (err) {
      console.warn(`Failed to load ${layer.id}:`, err);
      return;
    }
  }
  for (const layerId of layer.mapLayers) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', 'visible');
    }
  }
}

function deactivateLayer(map: maplibregl.Map, layer: LayerConfig) {
  for (const layerId of layer.mapLayers) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', 'none');
    }
  }
}

export default function LayerToggle() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(loadPersistedState);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const loadedRef = useRef(new Set<string>());
  const aircraftCount = useStore((s) => s.aircraft.size);
  const restoredRef = useRef(false);

  // On mount, restore persisted layer states once map is ready
  useEffect(() => {
    if (restoredRef.current) return;

    const tryRestore = () => {
      const map = mapInstanceRef.current;
      if (!map) return false;

      const doRestore = async () => {
        if (restoredRef.current) return;
        restoredRef.current = true;
        const persisted = loadPersistedState();
        for (const layer of LAYERS) {
          if (persisted[layer.id]) {
            await activateLayer(map, layer, loadedRef.current);
          }
        }
      };

      if (map.isStyleLoaded()) {
        doRestore();
      } else {
        map.on('load', () => doRestore());
      }
      return true;
    };

    if (!tryRestore()) {
      const timer = setInterval(() => {
        if (tryRestore()) clearInterval(timer);
      }, 200);
      return () => clearInterval(timer);
    }
  }, []);

  const handleToggle = async (layer: LayerConfig) => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const newState = !enabled[layer.id];

    if (newState) {
      setLoading((p) => ({ ...p, [layer.id]: true }));
      await activateLayer(map, layer, loadedRef.current);
      setLoading((p) => ({ ...p, [layer.id]: false }));
    } else {
      deactivateLayer(map, layer);
    }

    setEnabled((prev) => {
      const next = { ...prev, [layer.id]: newState };
      persistState(next);
      return next;
    });
  };

  return (
    <div className="absolute bottom-8 right-3 z-20 pointer-events-auto">
      {/* Expanded panel */}
      {open && (
        <div className="mb-2 bg-surface-0/95 backdrop-blur-sm border border-border rounded-sm shadow-lg animate-fade-in min-w-[180px]">
          <div className="px-3 py-2 border-b border-border-dim">
            <span className="label-caps">Map Layers</span>
          </div>
          <div className="py-1">
            {LAYERS.map((layer) => (
              <button
                key={layer.id}
                onClick={() => handleToggle(layer)}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-1 transition-colors text-left cursor-pointer"
              >
                {/* Toggle indicator */}
                <div
                  className={`w-3 h-3 rounded-sm border transition-colors flex-shrink-0 ${
                    enabled[layer.id]
                      ? 'bg-accent-cyan border-accent-cyan'
                      : 'border-border bg-transparent'
                  }`}
                >
                  {enabled[layer.id] && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#0a1628" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                {/* Icon */}
                <span className={`flex-shrink-0 ${enabled[layer.id] ? 'text-text-primary' : 'text-text-dim'}`}>
                  {layer.icon}
                </span>

                {/* Label */}
                <span className={`text-[11px] font-medium ${enabled[layer.id] ? 'text-text-primary' : 'text-text-dim'}`}>
                  {layer.label}
                </span>

                {/* Loading spinner */}
                {loading[layer.id] && (
                  <div className="ml-auto w-3 h-3 border border-accent-cyan border-t-transparent rounded-full animate-spin" />
                )}

                {/* Aircraft count badge */}
                {layer.id === 'aircraft' && enabled[layer.id] && aircraftCount > 0 && !loading[layer.id] && (
                  <span className="ml-auto text-[9px] font-data text-accent-cyan">{aircraftCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-sm border shadow-lg transition-colors cursor-pointer ${
          open
            ? 'bg-accent-cyan/20 border-accent-cyan/40 text-accent-cyan'
            : 'bg-surface-0/90 backdrop-blur-sm border-border text-text-dim hover:text-text-primary hover:border-border'
        }`}
        aria-label="Toggle map layers"
      >
        <Layers size={14} />
        <span className="text-[10px] font-semibold uppercase tracking-wider">Layers</span>
      </button>
    </div>
  );
}
