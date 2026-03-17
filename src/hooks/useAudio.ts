import { useRef, useCallback, useEffect, useState } from 'react';
import { useStore } from '../store';
import { generateShippingForecast } from '../utils/shippingForecast';

interface AudioState {
  enabled: boolean;
  volume: number;
  ambienceVolume: number;   // 0-1 independent ambience level
  radioVolume: number;      // 0-1 independent VHF level
  oceanEnabled: boolean;
  sonarEnabled: boolean;    // kept internally — tied to oceanEnabled
  radioEnabled: boolean;
  uiSoundsEnabled: boolean;
  radioStreamIndex: number; // -1 = auto (cascade), 0+ = specific stream
  forecastEnabled: boolean;
}

const DEFAULT_STATE: AudioState = {
  enabled: false,
  volume: 0.3,
  ambienceVolume: 0.7,
  radioVolume: 0.7,
  oceanEnabled: true,
  sonarEnabled: true,
  radioEnabled: true,
  uiSoundsEnabled: true,
  radioStreamIndex: -1,
  forecastEnabled: true,
};

function loadState(): AudioState {
  const stored = localStorage.getItem('hormuz-audio');
  if (!stored) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(stored);
    if ('ambientEnabled' in parsed && !('oceanEnabled' in parsed)) {
      const ambient = parsed.ambientEnabled;
      return {
        ...DEFAULT_STATE,
        enabled: parsed.enabled ?? false,
        volume: parsed.volume ?? 0.3,
        oceanEnabled: ambient,
        sonarEnabled: ambient,
        radioEnabled: ambient,
        uiSoundsEnabled: parsed.uiSoundsEnabled ?? true,
      };
    }
    // Ensure new fields have defaults
    const state = { ...DEFAULT_STATE, ...parsed };
    // Migrate: sonar follows ambience
    state.sonarEnabled = state.oceanEnabled;
    return state;
  } catch {
    return DEFAULT_STATE;
  }
}

// ── Procedural sound generators ──

interface AmbientLayer {
  stop: () => void;
  setVolume?: (v: number) => void;
}

/** Create a looping noise buffer with pink-ish spectrum (more bass) */
function createPinkNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = sr * durationSec;
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);

  // Voss-McCartney pink noise approximation (7 octaves)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buf;
}


/**
 * Ocean ambience — two layers:
 * 1. Pink noise bed (lowpass filtered) — warm deep ocean feel
 * 2. VHF static hiss (bandpass white noise) — always-on radio atmosphere
 */
function createOceanLayer(ctx: AudioContext, masterGain: GainNode, ambienceVolume: number = 0.7): AmbientLayer {
  const sources: AudioBufferSourceNode[] = [];

  // Ambience sub-gain (controlled by ambienceVolume slider)
  const ambienceGain = ctx.createGain();
  ambienceGain.gain.value = ambienceVolume;
  ambienceGain.connect(masterGain);

  // Layer 1: Pink noise ocean bed
  const bed = ctx.createBufferSource();
  bed.buffer = createPinkNoiseBuffer(ctx, 4);
  bed.loop = true;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 250;
  lp.Q.value = 0.3;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 30;
  hp.Q.value = 0.3;

  const oceanGain = ctx.createGain();
  oceanGain.gain.value = 0.03;

  bed.connect(hp);
  hp.connect(lp);
  lp.connect(oceanGain);
  oceanGain.connect(ambienceGain);
  bed.start();
  sources.push(bed);

  // Layer 2: VHF static hiss — constant radio atmosphere
  const staticNoise = ctx.createBufferSource();
  staticNoise.buffer = createWhiteNoiseBuffer(ctx, 3);
  staticNoise.loop = true;

  const staticBp = ctx.createBiquadFilter();
  staticBp.type = 'bandpass';
  staticBp.frequency.value = 2000;
  staticBp.Q.value = 0.5;

  const staticGain = ctx.createGain();
  staticGain.gain.value = 0.004; // very quiet background hiss

  staticNoise.connect(staticBp);
  staticBp.connect(staticGain);
  staticGain.connect(ambienceGain);
  staticNoise.start();
  sources.push(staticNoise);

  return {
    stop: () => {
      for (const s of sources) {
        try { s.stop(); } catch { /* already stopped */ }
      }
    },
    setVolume: (v: number) => {
      ambienceGain.gain.setValueAtTime(v, ctx.currentTime);
    },
  };
}

/** Sonar ping — periodic sine tone with exponential decay and slight reverb tail */
function createSonarLayer(ctx: AudioContext, masterGain: GainNode, ambienceVolume: number = 0.7): AmbientLayer {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  // Ambience sub-gain for sonar
  const sonarAmbienceGain = ctx.createGain();
  sonarAmbienceGain.gain.value = ambienceVolume;
  sonarAmbienceGain.connect(masterGain);

  const ping = () => {
    if (stopped) return;
    try {
      const t = ctx.currentTime;

      // Main ping tone
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 1200;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.014, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);

      osc.connect(gain);
      gain.connect(sonarAmbienceGain);

      osc.start(t);
      osc.stop(t + 1.5);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    } catch { /* ctx closed */ }
  };

  const firstTimeout = setTimeout(ping, 2500);
  intervalId = setInterval(ping, 7000 + Math.random() * 5000);

  return {
    stop: () => {
      stopped = true;
      clearTimeout(firstTimeout);
      if (intervalId) clearInterval(intervalId);
    },
    setVolume: (v: number) => {
      sonarAmbienceGain.gain.setValueAtTime(v, ctx.currentTime);
    },
  };
}

/** Create a looping white noise buffer */
function createWhiteNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = sr * durationSec;
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

// Live marine VHF radio streams — real human radio chatter
// Uses plain HTML5 Audio (no Web Audio API routing) to avoid CORS restrictions.
// Volume is controlled directly via audio.volume instead of through the gain chain.
// Streams are ordered by preference — European maritime first, US as fallback.
// Every 5 minutes, retries preferred streams so we don't get stuck on a fallback.
export const MARINE_STREAMS = [
  { url: 'https://broadcastify.cdnstream1.com/44085', label: 'NW Ireland (CH16)' },
  { url: 'https://broadcastify.cdnstream1.com/40213', label: 'Vlissingen (North Sea)' },
  { url: 'https://broadcastify.cdnstream1.com/20660', label: 'Netherlands CG' },
  { url: 'https://broadcastify.cdnstream1.com/12874', label: 'Terheijde (Dutch)' },
  { url: 'https://broadcastify.cdnstream1.com/35475', label: 'VHF CH 16/67/61' },
  { url: 'https://broadcastify.cdnstream1.com/44773', label: 'Marine SAR' },
  { url: 'https://broadcastify.cdnstream1.com/17329', label: 'NJ/NY Marine' },
];

/** Marine radio — live Broadcastify VHF stream via plain HTML5 Audio (no CORS issues) */
function createRadioLayer(_ctx: AudioContext, _masterGain: GainNode, volume: number, forcedIndex: number): AmbientLayer {
  const audio = new Audio();
  let stopped = false;
  let streamIndex = forcedIndex >= 0 ? forcedIndex : 0;
  let currentStreamIndex = -1;
  let retryTimer: ReturnType<typeof setInterval> | null = null;
  const isForced = forcedIndex >= 0;

  const setVol = (v: number) => {
    audio.volume = Math.max(0, Math.min(1, v * 0.8));
  };
  setVol(volume);

  const tryStream = () => {
    if (stopped || streamIndex >= MARINE_STREAMS.length) return;
    audio.src = MARINE_STREAMS[streamIndex].url;
    audio.play().catch(() => {
      // If forced to a specific stream and it fails, cascade from next
      streamIndex++;
      setTimeout(tryStream, 500);
    });
  };

  audio.onerror = () => {
    if (stopped) return;
    streamIndex++;
    setTimeout(tryStream, 500);
  };

  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  audio.onplaying = () => {
    if (stallTimer) clearTimeout(stallTimer);
    currentStreamIndex = streamIndex;
  };
  audio.onwaiting = () => {
    if (stopped) return;
    stallTimer = setTimeout(() => {
      if (!stopped) { streamIndex++; tryStream(); }
    }, 10000);
  };

  tryStream();

  // In auto mode, periodically retry preferred streams if we fell back
  if (!isForced) {
    retryTimer = setInterval(() => {
      if (stopped || currentStreamIndex <= 0) return;
      streamIndex = 0;
      audio.pause();
      tryStream();
    }, 5 * 60_000);
  }

  return {
    stop: () => {
      stopped = true;
      audio.pause();
      audio.src = '';
      if (stallTimer) clearTimeout(stallTimer);
      if (retryTimer) clearInterval(retryTimer);
    },
    setVolume: setVol,
  };
}

/** Cached British voice — resolved once voices load (async in Chrome) */
let cachedBritishVoice: SpeechSynthesisVoice | null = null;
let voicesResolved = false;

function resolveBritishVoice() {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  if (voices.length === 0) return;
  cachedBritishVoice = voices.find(v => v.lang === 'en-GB') ??
                       voices.find(v => v.lang.startsWith('en-')) ??
                       null;
  voicesResolved = true;
}

// Eagerly resolve on load + listen for async voiceschanged
if (typeof window !== 'undefined' && window.speechSynthesis) {
  resolveBritishVoice();
  window.speechSynthesis.addEventListener('voiceschanged', resolveBritishVoice);
}

/** Speak a forecast utterance with consistent settings */
function speakForecast(text: string, volume: number) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  if (!voicesResolved) resolveBritishVoice();
  if (cachedBritishVoice) utterance.voice = cachedBritishVoice;
  utterance.rate = 0.9;
  utterance.pitch = 0.9;
  utterance.volume = Math.max(0, Math.min(1, volume));
  window.speechSynthesis.speak(utterance);
}

/** Shipping forecast — speaks at fixed clock times (:00 and :30).
 *  Does NOT auto-speak on creation — only at the next half-hour mark.
 *  Use speakForecastNow() for manual trigger. */
function createForecastLayer(volume: number): AmbientLayer {
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let currentVolume = volume;

  const speak = () => {
    if (stopped) return;
    const weather = useStore.getState().weather;
    if (!weather.current) return;
    const { speakText } = generateShippingForecast(weather.current, weather.daily);
    speakForecast(speakText, currentVolume);
  };

  // Calculate ms until next :00 or :30
  const now = new Date();
  const mins = now.getMinutes();
  const nextHalf = mins < 30 ? 30 : 60;
  const msUntilNext = ((nextHalf - mins) * 60 - now.getSeconds()) * 1000 - now.getMilliseconds();

  // First speak at the next half-hour, then every 30 min
  timeoutId = setTimeout(() => {
    speak();
    intervalId = setInterval(speak, 30 * 60_000);
  }, msUntilNext);

  return {
    stop: () => {
      stopped = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
      window.speechSynthesis?.cancel();
    },
    setVolume: (v: number) => { currentVolume = v; },
  };
}

// ── Hook ──

export function useAudio() {
  const [state, setState] = useState<AudioState>(loadState);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const layersRef = useRef<{
    ocean: AmbientLayer | null;
    sonar: AmbientLayer | null;
    radio: AmbientLayer | null;
    forecast: AmbientLayer | null;
  }>({ ocean: null, sonar: null, radio: null, forecast: null });

  // Persist state
  useEffect(() => {
    localStorage.setItem('hormuz-audio', JSON.stringify(state));
  }, [state]);

  // Ensure AudioContext exists when enabled
  const ensureContext = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = state.volume;
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      masterGainRef.current = master;
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, [state.volume]);

  // Tear down everything
  const teardownAll = useCallback(() => {
    const layers = layersRef.current;
    if (layers.ocean) { layers.ocean.stop(); layers.ocean = null; }
    if (layers.sonar) { layers.sonar.stop(); layers.sonar = null; }
    if (layers.radio) { layers.radio.stop(); layers.radio = null; }
    if (layers.forecast) { layers.forecast.stop(); layers.forecast = null; }
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      ctxRef.current.close().catch(() => {});
    }
    ctxRef.current = null;
    masterGainRef.current = null;
  }, []);

  // Manage ambient layers based on state
  useEffect(() => {
    if (!state.enabled) {
      teardownAll();
      return;
    }

    const ctx = ensureContext();
    const master = masterGainRef.current!;
    const layers = layersRef.current;

    // Ocean + Sonar (both controlled by ambience toggle)
    if (state.oceanEnabled && !layers.ocean) {
      layers.ocean = createOceanLayer(ctx, master, state.ambienceVolume);
    } else if (!state.oceanEnabled && layers.ocean) {
      layers.ocean.stop();
      layers.ocean = null;
    }

    // Sonar follows ambience toggle
    if (state.oceanEnabled && !layers.sonar) {
      layers.sonar = createSonarLayer(ctx, master, state.ambienceVolume);
    } else if (!state.oceanEnabled && layers.sonar) {
      layers.sonar.stop();
      layers.sonar = null;
    }

    // Radio — recreate when stream selection changes
    if (state.radioEnabled && !layers.radio) {
      layers.radio = createRadioLayer(ctx, master, state.volume * state.radioVolume, state.radioStreamIndex);
    } else if (!state.radioEnabled && layers.radio) {
      layers.radio.stop();
      layers.radio = null;
    }

    // Forecast — speech synthesis
    if (state.forecastEnabled && !layers.forecast) {
      layers.forecast = createForecastLayer(state.volume);
    } else if (!state.forecastEnabled && layers.forecast) {
      layers.forecast.stop();
      layers.forecast = null;
    }

    return () => {
      teardownAll();
    };
  }, [state.enabled, state.oceanEnabled, state.radioEnabled, state.radioStreamIndex, state.forecastEnabled]);

  // Update master volume and per-channel volumes
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.setValueAtTime(state.volume, ctxRef.current?.currentTime ?? 0);
    }
    // Ambience volume controls ocean + sonar layers
    if (layersRef.current.ocean?.setVolume) {
      layersRef.current.ocean.setVolume(state.ambienceVolume);
    }
    if (layersRef.current.sonar?.setVolume) {
      layersRef.current.sonar.setVolume(state.ambienceVolume);
    }
    // Radio gets master * radioVolume
    if (layersRef.current.radio?.setVolume) {
      layersRef.current.radio.setVolume(state.volume * state.radioVolume);
    }
    if (layersRef.current.forecast?.setVolume) {
      layersRef.current.forecast.setVolume(state.volume);
    }
  }, [state.volume, state.ambienceVolume, state.radioVolume]);

  // UI sound effect player
  const playSound = useCallback((type: 'ping' | 'alert' | 'click') => {
    if (!state.enabled || !state.uiSoundsEnabled) return;

    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.value = state.volume * 0.15;

      switch (type) {
        case 'ping':
          osc.frequency.value = 880;
          osc.type = 'sine';
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
          break;
        case 'alert':
          osc.frequency.value = 660;
          osc.type = 'triangle';
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          osc.start();
          osc.stop(ctx.currentTime + 0.5);
          break;
        case 'click':
          osc.frequency.value = 1200;
          osc.type = 'sine';
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
          osc.start();
          osc.stop(ctx.currentTime + 0.05);
          break;
      }

      osc.onended = () => ctx.close();
    } catch {
      // Audio not supported
    }
  }, [state.enabled, state.uiSoundsEnabled, state.volume]);

  const toggle = useCallback(() => {
    setState(s => ({ ...s, enabled: !s.enabled }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setState(s => ({ ...s, volume: Math.max(0, Math.min(1, volume)) }));
  }, []);

  const toggleOcean = useCallback(() => {
    setState(s => ({ ...s, oceanEnabled: !s.oceanEnabled, sonarEnabled: !s.oceanEnabled }));
  }, []);

  const toggleSonar = useCallback(() => {
    setState(s => ({ ...s, sonarEnabled: !s.sonarEnabled }));
  }, []);

  const setAmbienceVolume = useCallback((v: number) => {
    setState(s => ({ ...s, ambienceVolume: Math.max(0, Math.min(1, v)) }));
  }, []);

  const setRadioVolume = useCallback((v: number) => {
    setState(s => ({ ...s, radioVolume: Math.max(0, Math.min(1, v)) }));
  }, []);

  const toggleRadio = useCallback(() => {
    setState(s => ({ ...s, radioEnabled: !s.radioEnabled }));
  }, []);

  const setRadioStream = useCallback((index: number) => {
    setState(s => {
      if (s.radioStreamIndex === index) return s;
      return { ...s, radioStreamIndex: index };
    });
    // Force radio layer to recreate with new stream
    const layers = layersRef.current;
    if (layers.radio) {
      layers.radio.stop();
      layers.radio = null;
    }
  }, []);

  const toggleForecast = useCallback(() => {
    setState(s => ({ ...s, forecastEnabled: !s.forecastEnabled }));
  }, []);

  const speakForecastNow = useCallback(() => {
    if (!state.enabled || !state.forecastEnabled) return;
    const weather = useStore.getState().weather;
    if (!weather.current) return;
    const { speakText } = generateShippingForecast(weather.current, weather.daily);
    speakForecast(speakText, state.volume);
  }, [state.enabled, state.forecastEnabled, state.volume]);

  const toggleUiSounds = useCallback(() => {
    setState(s => ({ ...s, uiSoundsEnabled: !s.uiSoundsEnabled }));
  }, []);

  return {
    ...state,
    toggle,
    setVolume,
    setAmbienceVolume,
    setRadioVolume,
    toggleOcean,
    toggleSonar,
    toggleRadio,
    setRadioStream,
    toggleForecast,
    speakForecastNow,
    toggleUiSounds,
    playSound,
  };
}
