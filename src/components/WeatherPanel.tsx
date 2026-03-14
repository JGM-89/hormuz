import { useEffect } from 'react';
import { useStore } from '../store';
import { toBeaufort, computePassageRisk, windDirToCompass, RISK_CONFIG } from '../utils/weather';
import type { WeatherCurrent, WeatherForecastDay } from '../types';

const KMH_TO_KN = 1 / 1.852;

export default function WeatherPanel() {
  const weather = useStore((s) => s.weather);
  const setWeather = useStore((s) => s.setWeather);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const [atmo, marine] = await Promise.all([
          fetch(
            'https://api.open-meteo.com/v1/forecast?latitude=26.5&longitude=56.3' +
            '&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility' +
            '&daily=wind_speed_10m_max,wind_gusts_10m_max,temperature_2m_min,temperature_2m_max' +
            '&forecast_days=5&timezone=auto',
          ).then((r) => r.json()),
          fetch(
            'https://marine-api.open-meteo.com/v1/marine?latitude=26.5&longitude=56.3' +
            '&current=wave_height' +
            '&daily=wave_height_max' +
            '&forecast_days=5&timezone=auto',
          ).then((r) => r.json()),
        ]);

        // Current conditions
        const windKn = Math.round(atmo.current.wind_speed_10m * KMH_TO_KN);
        const gustsKn = Math.round(atmo.current.wind_gusts_10m * KMH_TO_KN);
        const waveHeight = marine.current.wave_height;
        const visibility = atmo.current.visibility ? atmo.current.visibility / 1000 : 20; // m → km
        const bf = toBeaufort(windKn);
        const risk = computePassageRisk(windKn, gustsKn, waveHeight, visibility);

        const current: WeatherCurrent = {
          windSpeed: windKn,
          windDir: atmo.current.wind_direction_10m,
          windGusts: gustsKn,
          temp: Math.round(atmo.current.temperature_2m),
          waveHeight,
          visibility: Math.round(visibility),
          beaufort: bf.scale,
          beaufortLabel: bf.label,
          passageRisk: risk,
          updatedAt: Date.now(),
        };

        // Daily forecast
        const daily: WeatherForecastDay[] = [];
        const days = atmo.daily?.time || [];
        for (let i = 0; i < days.length && i < 5; i++) {
          const dayWindMax = Math.round((atmo.daily.wind_speed_10m_max?.[i] || 0) * KMH_TO_KN);
          const dayGustsMax = Math.round((atmo.daily.wind_gusts_10m_max?.[i] || 0) * KMH_TO_KN);
          const dayWaveMax = marine.daily?.wave_height_max?.[i] || 0;
          const dayBf = toBeaufort(dayWindMax);
          const dayRisk = computePassageRisk(dayWindMax, dayGustsMax, dayWaveMax, 20);
          const date = new Date(days[i] + 'T00:00:00');

          daily.push({
            date: days[i],
            label: date.toLocaleDateString('en', { weekday: 'short' }),
            windSpeedMax: dayWindMax,
            windGustsMax: dayGustsMax,
            waveHeightMax: dayWaveMax,
            tempMin: Math.round(atmo.daily.temperature_2m_min?.[i] || 0),
            tempMax: Math.round(atmo.daily.temperature_2m_max?.[i] || 0),
            beaufortMax: dayBf.scale,
            passageRisk: dayRisk,
          });
        }

        setWeather({ current, daily });
      } catch {
        // silently fail
      }
    }

    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60_000);
    return () => clearInterval(interval);
  }, [setWeather]);

  if (!weather.current) return null;
  const { current, daily } = weather;
  const risk = RISK_CONFIG[current.passageRisk];

  return (
    <div className="p-2.5 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="label-caps">Strait Conditions</span>
        <span className="text-[9px] text-status-nominal font-data uppercase tracking-wider">LIVE</span>
      </div>

      {/* Current conditions grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* Wind */}
        <div className="bg-surface-1 rounded-sm p-1.5">
          <div className="label-caps mb-0.5">Wind</div>
          <div className="flex items-center gap-1.5">
            <WindArrow degrees={current.windDir} />
            <span className="text-[12px] font-data font-bold text-text-primary">{current.windSpeed}kn</span>
            <span className="text-[10px] font-data text-text-dim">G{current.windGusts}</span>
          </div>
          <div className="text-[9px] text-text-dim font-data mt-0.5">{windDirToCompass(current.windDir)}</div>
        </div>

        {/* Beaufort */}
        <div className="bg-surface-1 rounded-sm p-1.5">
          <div className="label-caps mb-0.5">Beaufort</div>
          <div className="flex items-baseline gap-1">
            <span className={`text-[12px] font-data font-bold ${current.beaufort >= 7 ? 'text-status-crit' : current.beaufort >= 5 ? 'text-status-warn' : 'text-status-nominal'}`}>
              BF {current.beaufort}
            </span>
          </div>
          <div className="text-[9px] text-text-dim mt-0.5">{current.beaufortLabel}</div>
        </div>

        {/* Waves */}
        <div className="bg-surface-1 rounded-sm p-1.5">
          <div className="label-caps mb-0.5">Waves</div>
          <span className={`text-[12px] font-data font-bold ${current.waveHeight >= 2.5 ? 'text-status-crit' : current.waveHeight >= 1.5 ? 'text-status-warn' : 'text-status-nominal'}`}>
            {current.waveHeight}m
          </span>
        </div>

        {/* Temp + Visibility */}
        <div className="bg-surface-1 rounded-sm p-1.5">
          <div className="label-caps mb-0.5">Conditions</div>
          <div className="text-[12px] font-data font-bold text-text-primary">{current.temp}°C</div>
          <div className="text-[9px] text-text-dim font-data mt-0.5">Vis {current.visibility}km</div>
        </div>
      </div>

      {/* Passage Risk */}
      <div
        className="rounded-sm p-2 border"
        style={{ backgroundColor: `${risk.color}08`, borderColor: `${risk.color}30` }}
      >
        <div className="flex items-center gap-2">
          <div className={`led ${risk.ledClass}`} />
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: risk.color }}>
            {risk.label} RISK
          </span>
        </div>
        <div className="text-[10px] text-text-dim mt-1">
          {getRiskRationale(current)}
        </div>
      </div>

      {/* 5-Day Forecast */}
      {daily.length > 0 && (
        <div>
          <div className="label-caps mb-1.5">5-Day Forecast</div>
          <div className="flex gap-1">
            {daily.map((day) => {
              const dayRisk = RISK_CONFIG[day.passageRisk];
              return (
                <div
                  key={day.date}
                  className="flex-1 bg-surface-1 rounded-sm p-1.5 text-center"
                  title={`${day.label}: Wind ${day.windSpeedMax}kn G${day.windGustsMax}, Waves ${day.waveHeightMax}m, ${day.tempMin}-${day.tempMax}°C`}
                >
                  <div className="text-[9px] text-text-dim font-semibold uppercase">{day.label}</div>
                  <div className="flex justify-center my-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: dayRisk.color, boxShadow: `0 0 4px ${dayRisk.color}` }}
                    />
                  </div>
                  <div className="text-[10px] font-data text-text-primary">{day.windSpeedMax}kn</div>
                  <div className={`text-[9px] font-data ${day.waveHeightMax >= 2.5 ? 'text-status-crit' : day.waveHeightMax >= 1.5 ? 'text-status-warn' : 'text-text-dim'}`}>
                    {day.waveHeightMax}m
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function getRiskRationale(current: WeatherCurrent): string {
  const factors: string[] = [];
  if (current.windSpeed >= 20) factors.push(`Wind ${current.windSpeed}kn`);
  if (current.windGusts >= 35) factors.push(`Gusts ${current.windGusts}kn`);
  if (current.waveHeight >= 1.5) factors.push(`${current.waveHeight}m waves`);
  if (current.visibility < 5) factors.push(`Vis ${current.visibility}km`);

  if (factors.length === 0) return 'Favorable conditions for passage';
  return factors.join(' with ');
}

function WindArrow({ degrees }: { degrees: number }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 12 12"
      style={{ transform: `rotate(${degrees}deg)` }}
      aria-hidden="true"
    >
      <path d="M6 1L3 9h6L6 1z" fill="#7a8ba3" />
    </svg>
  );
}
