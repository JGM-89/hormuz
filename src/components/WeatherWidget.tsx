import { useEffect, useState } from 'react';
import Widget from './Widget';

interface WeatherData {
  windSpeed: number;   // knots
  windDir: number;     // degrees
  windGusts: number;   // knots
  temp: number;        // celsius
  waveHeight: number;  // meters
}

const KMH_TO_KN = 1 / 1.852;

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const [atmo, marine] = await Promise.all([
          fetch('https://api.open-meteo.com/v1/forecast?latitude=26.5&longitude=56.3&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m').then(r => r.json()),
          fetch('https://marine-api.open-meteo.com/v1/marine?latitude=26.5&longitude=56.3&current=wave_height').then(r => r.json()),
        ]);
        setWeather({
          windSpeed: Math.round(atmo.current.wind_speed_10m * KMH_TO_KN),
          windDir: atmo.current.wind_direction_10m,
          windGusts: Math.round(atmo.current.wind_gusts_10m * KMH_TO_KN),
          temp: Math.round(atmo.current.temperature_2m),
          waveHeight: marine.current.wave_height,
        });
      } catch {
        // silently fail
      }
    }
    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!weather) return null;

  return (
    <Widget
      role="region"
      aria-label={`Strait conditions: wind ${weather.windSpeed} knots, ${weather.temp}°C, waves ${weather.waveHeight}m`}
    >
      <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1.5">
        Strait Conditions
      </div>
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5" title={`Wind direction: ${weather.windDir}°`}>
          <WindArrow degrees={weather.windDir} />
          <span className="text-slate-200">{weather.windSpeed}kn</span>
          <span className="text-slate-500">gust {weather.windGusts}</span>
        </div>
        <span className="text-slate-600" aria-hidden="true">&middot;</span>
        <span className="text-slate-200">{weather.temp}°C</span>
        <span className="text-slate-600" aria-hidden="true">&middot;</span>
        <span className="text-slate-200">Waves {weather.waveHeight}m</span>
      </div>
    </Widget>
  );
}

function WindArrow({ degrees }: { degrees: number }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      style={{ transform: `rotate(${degrees}deg)` }}
      aria-hidden="true"
      role="img"
    >
      <path d="M6 1L3 9h6L6 1z" fill="#94a3b8" />
    </svg>
  );
}
