/**
 * Overlay data for map layers.
 * All data is generated locally — no API calls needed.
 */

import militaryBasesData from '../data/military-bases.json';

/** Shipping lanes — approximate major Gulf shipping routes */
export const SHIPPING_LANES: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Hormuz Inbound Lane', type: 'major' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [58.5, 25.0], [57.5, 26.0], [56.8, 26.3], [56.3, 26.35], [56.0, 26.2],
          [55.5, 26.4], [54.5, 26.3], [53.5, 26.8], [52.0, 27.0], [51.0, 27.5],
          [50.5, 27.8], [50.2, 28.5], [49.8, 29.0], [49.5, 29.5],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Hormuz Outbound Lane', type: 'major' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [49.5, 29.3], [50.0, 28.8], [50.3, 28.2], [50.8, 27.6], [51.5, 27.3],
          [52.5, 26.9], [53.8, 26.6], [55.0, 26.3], [55.8, 26.5], [56.3, 26.55],
          [56.8, 26.55], [57.0, 26.6], [57.5, 26.2], [58.5, 25.2],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Fujairah Approach', type: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [58.0, 24.5], [57.0, 25.0], [56.4, 25.1], [56.0, 25.3],
          [55.5, 25.3], [55.0, 25.2], [54.5, 24.5],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Muscat Approach', type: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [60.0, 23.5], [59.0, 23.6], [58.5, 23.6], [58.0, 23.6], [57.5, 23.8],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Kuwait Channel', type: 'secondary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [49.5, 29.5], [49.0, 29.2], [48.5, 29.5], [48.2, 29.8], [48.0, 30.0],
        ],
      },
    },
  ],
};

/** EEZ boundaries — approximate Gulf median lines */
export const EEZ_BOUNDARIES: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Iran-UAE EEZ', type: 'eez' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [56.3, 26.1], [55.8, 26.0], [55.2, 25.8], [54.5, 25.5],
          [54.0, 25.5], [53.5, 25.8], [53.0, 26.0], [52.5, 26.2],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Iran-Oman EEZ', type: 'eez' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [57.0, 26.5], [56.8, 26.4], [56.5, 26.3], [56.3, 26.1],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Iran-Qatar EEZ', type: 'eez' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [52.5, 26.2], [52.0, 26.5], [51.5, 26.8], [51.2, 27.0],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Iran-Kuwait EEZ', type: 'eez' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [50.5, 28.5], [50.0, 28.8], [49.8, 29.0], [49.5, 29.3],
          [49.2, 29.5], [49.0, 29.8],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Saudi-Iran EEZ', type: 'eez' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [51.2, 27.0], [50.8, 27.5], [50.5, 28.0], [50.5, 28.5],
        ],
      },
    },
  ],
};

/** Military bases GeoJSON */
export const MILITARY_BASES: GeoJSON.FeatureCollection = militaryBasesData as unknown as GeoJSON.FeatureCollection;
