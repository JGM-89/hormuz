import { useEffect, useState } from 'react';

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
    <div className="absolute bottom-10 right-14 z-10 bg-slate-900/80 backdrop-blur-md rounded-lg border border-slate-700/50 p-3 shadow-xl">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">
        Strait Conditions
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        <div className="flex items-center gap-1.5">
          <WindArrow degrees={weather.windDir} />
          <span className="text-slate-300">{weather.windSpeed}kn</span>
          <span className="text-slate-500">gust {weather.windGusts}</span>
        </div>
        <div className="text-slate-300">{weather.temp}°C</div>
        <div className="text-slate-300 col-span-2">
          Waves: {weather.waveHeight}m
        </div>
      </div>
    </div>
  );
}

function WindArrow({ degrees }: { degrees: number }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: `rotate(${degrees}deg)` }}>
      <path d="M6 1L3 9h6L6 1z" fill="#64748b" />
    </svg>
  );
}
