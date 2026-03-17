import { useState, useEffect, useRef } from 'react';
import { Layers, Plane, Ship, Shield, Satellite, MapPin, Navigation } from 'lucide-react';
import { mapInstanceRef } from './Map';
import { useStore } from '../store';

interface LayerConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  mapLayers: string[];
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
  },
  {
    id: 'military-bases',
    label: 'Military Bases',
    icon: <Shield size={14} />,
    mapLayers: ['military-bases-circles', 'military-bases-labels'],
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
  },
  {
    id: 'tss',
    label: 'TSS / Chokepoint',
    icon: <Navigation size={14} />,
    mapLayers: ['tss-inbound', 'tss-outbound', 'chokepoint-fill', 'chokepoint-border'],
  },
];

const STORAGE_KEY = 'hormuz-layers';

// Default: everything on except satellite
const DEFAULT_LAYERS: Record<string, boolean> = {
  aircraft: true,
  'shipping-lanes': true,
  'military-bases': true,
  satellite: false,
  eez: true,
  tss: true,
};

function loadPersistedState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_LAYERS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_LAYERS };
}

function persistState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function setLayerVisibility(layerIds: string[], visible: boolean) {
  const map = mapInstanceRef.current;
  if (!map || !map.isStyleLoaded()) return;
  const vis = visible ? 'visible' : 'none';
  for (const id of layerIds) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', vis);
    }
  }
}

export default function LayerToggle() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(loadPersistedState);
  const aircraftCount = useStore((s) => s.aircraft.size);
  const restoredRef = useRef(false);

  // On mount, restore persisted layer visibility once all map layers are added
  useEffect(() => {
    if (restoredRef.current) return;

    const doRestore = () => {
      if (restoredRef.current) return;
      restoredRef.current = true;
      const persisted = loadPersistedState();
      for (const layer of LAYERS) {
        if (persisted[layer.id]) {
          setLayerVisibility(layer.mapLayers, true);
        }
      }
    };

    const tryListen = () => {
      const map = mapInstanceRef.current;
      if (!map) return false;
      // Listen for 'layers-ready' custom event fired after all overlay layers are added
      map.on('layers-ready', doRestore);
      return true;
    };

    if (!tryListen()) {
      const timer = setInterval(() => {
        if (tryListen()) clearInterval(timer);
      }, 200);
      return () => clearInterval(timer);
    }
  }, []);

  const handleToggle = (layer: LayerConfig) => {
    const newState = !enabled[layer.id];
    setLayerVisibility(layer.mapLayers, newState);
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

                {/* Aircraft count badge */}
                {layer.id === 'aircraft' && enabled[layer.id] && aircraftCount > 0 && (
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
