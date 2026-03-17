import type { WeatherCurrent, WeatherForecastDay } from '../types';
import { windDirToCompass } from './weather';

/** Sea state description based on Beaufort scale */
function seaState(beaufort: number): string {
  if (beaufort <= 1) return 'calm';
  if (beaufort === 2) return 'smooth';
  if (beaufort === 3) return 'slight';
  if (beaufort === 4) return 'moderate';
  if (beaufort === 5) return 'rough';
  if (beaufort === 6) return 'very rough';
  if (beaufort === 7) return 'high';
  if (beaufort <= 9) return 'very high';
  return 'phenomenal';
}

/** Visibility descriptor */
function visibilityDesc(km: number): string {
  if (km >= 10) return 'good';
  if (km >= 5) return 'moderate';
  if (km >= 2) return 'poor';
  return 'very poor';
}

/** Risk advisory text */
function riskAdvisory(risk: string): string {
  switch (risk) {
    case 'low': return 'Conditions favourable for all vessel classes.';
    case 'moderate': return 'Small craft should exercise caution. Standard passage protocols apply.';
    case 'high': return 'Passage not recommended for small craft. VLCCs should proceed with caution.';
    case 'severe': return 'All vessels advised to seek shelter or delay transit. Dangerous conditions.';
    default: return '';
  }
}

/** Format day label for forecast outlook */
function dayLabel(day: WeatherForecastDay): string {
  const risk = day.passageRisk.toUpperCase();
  return `${day.label}: Wind to ${Math.round(day.windSpeedMax)} knots, waves to ${day.waveHeightMax.toFixed(1)} metres. ${risk} risk.`;
}

interface ShippingForecast {
  /** Formatted text for display (with line breaks) */
  text: string;
  /** Plain prose optimised for speech synthesis */
  speakText: string;
}

export function generateShippingForecast(
  current: WeatherCurrent,
  daily: WeatherForecastDay[],
): ShippingForecast {
  const now = new Date();
  const utcTime = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
  const compass = windDirToCompass(current.windDir);
  const sea = seaState(current.beaufort);
  const vis = visibilityDesc(current.visibility);
  const risk = current.passageRisk.toUpperCase();

  // Display text
  const lines = [
    'HORMUZ STRAIT SHIPPING FORECAST',
    `Issued ${utcTime} UTC`,
    '',
    `SYNOPSIS: ${risk} passage conditions.`,
    '',
    'CURRENT CONDITIONS:',
    `${compass} ${Math.round(current.windSpeed)} knots, gusting ${Math.round(current.windGusts)}.`,
    `Sea state ${sea}, wave height ${current.waveHeight.toFixed(1)} metres.`,
    `Visibility ${vis}, ${Math.round(current.visibility)} kilometres.`,
    `Temperature ${Math.round(current.temp)} degrees.`,
  ];

  // Outlook — next 2 days from forecast
  const outlook = daily.slice(0, 2);
  if (outlook.length > 0) {
    lines.push('', 'OUTLOOK:');
    for (const day of outlook) {
      lines.push(dayLabel(day));
    }
  }

  lines.push('', `PASSAGE RISK: ${risk}`);
  lines.push(riskAdvisory(current.passageRisk));

  const text = lines.join('\n');

  // Speech version — natural prose, no labels
  const speakParts = [
    `Hormuz Strait shipping forecast, issued at ${utcTime} U.T.C.`,
    `${risk.toLowerCase()} passage conditions.`,
    `Wind ${compass.toLowerCase()}, ${Math.round(current.windSpeed)} knots, gusting ${Math.round(current.windGusts)}.`,
    `Sea state ${sea}, wave height ${current.waveHeight.toFixed(1)} metres.`,
    `Visibility ${vis}.`,
    `Temperature ${Math.round(current.temp)} degrees.`,
  ];

  if (outlook.length > 0) {
    speakParts.push('Outlook.');
    for (const day of outlook) {
      speakParts.push(
        `${day.label}. Wind to ${Math.round(day.windSpeedMax)} knots, waves to ${day.waveHeightMax.toFixed(1)} metres. ${day.passageRisk} risk.`
      );
    }
  }

  speakParts.push(`Passage risk ${risk.toLowerCase()}.`);
  speakParts.push(riskAdvisory(current.passageRisk));

  return { text, speakText: speakParts.join(' ') };
}
