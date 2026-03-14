import { useRef, useCallback, useEffect, useState } from 'react';

interface AudioState {
  enabled: boolean;
  volume: number;
  oceanEnabled: boolean;
  sonarEnabled: boolean;
  radioEnabled: boolean;
  uiSoundsEnabled: boolean;
}

const DEFAULT_STATE: AudioState = {
  enabled: false,
  volume: 0.3,
  oceanEnabled: true,
  sonarEnabled: true,
  radioEnabled: true,
  uiSoundsEnabled: true,
};

function loadState(): AudioState {
  const stored = localStorage.getItem('hormuz-audio');
  if (!stored) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(stored);
    if ('ambientEnabled' in parsed && !('oceanEnabled' in parsed)) {
      const ambient = parsed.ambientEnabled;
      return {
        enabled: parsed.enabled ?? false,
        volume: parsed.volume ?? 0.3,
        oceanEnabled: ambient,
        sonarEnabled: ambient,
        radioEnabled: ambient,
        uiSoundsEnabled: parsed.uiSoundsEnabled ?? true,
      };
    }
    return { ...DEFAULT_STATE, ...parsed };
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
function createOceanLayer(ctx: AudioContext, masterGain: GainNode): AmbientLayer {
  const sources: AudioBufferSourceNode[] = [];

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
  oceanGain.connect(masterGain);
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
  staticGain.connect(masterGain);
  staticNoise.start();
  sources.push(staticNoise);

  return {
    stop: () => {
      for (const s of sources) {
        try { s.stop(); } catch { /* already stopped */ }
      }
    },
  };
}

/** Sonar ping — periodic sine tone with exponential decay and slight reverb tail */
function createSonarLayer(ctx: AudioContext, masterGain: GainNode): AmbientLayer {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

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
      gain.connect(masterGain);

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
const MARINE_STREAMS = [
  'https://broadcastify.cdnstream1.com/44085', // NW Ireland — VHF CH 16, 1, 2, 5 (UK/Irish Sea)
  'https://broadcastify.cdnstream1.com/40213', // Vlissingen — KNRM Coastguard, North Sea entrance
  'https://broadcastify.cdnstream1.com/20660', // Eems/Dollard — Netherlands Coastguard
  'https://broadcastify.cdnstream1.com/12874', // Terheijde — Dutch marine VHF
  'https://broadcastify.cdnstream1.com/35475', // VHF CH 16, 67, 61
  'https://broadcastify.cdnstream1.com/44773', // Marine SAR CH 16, 65A, 82A
  'https://broadcastify.cdnstream1.com/17329', // NJ/NY marine (last resort)
];

/** Marine radio — live Broadcastify VHF stream via plain HTML5 Audio (no CORS issues) */
function createRadioLayer(_ctx: AudioContext, _masterGain: GainNode, volume: number): AmbientLayer {
  const audio = new Audio();
  let stopped = false;
  let streamIndex = 0;
  let currentStreamIndex = -1;
  let retryTimer: ReturnType<typeof setInterval> | null = null;

  const setVol = (v: number) => {
    audio.volume = Math.max(0, Math.min(1, v * 0.8));
  };
  setVol(volume);

  const tryStream = () => {
    if (stopped || streamIndex >= MARINE_STREAMS.length) return;
    audio.src = MARINE_STREAMS[streamIndex];
    audio.play().catch(() => {
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

  // Periodically retry preferred streams if we fell back to a lower-priority one
  retryTimer = setInterval(() => {
    if (stopped || currentStreamIndex <= 0) return;
    // Try to reconnect to the top-priority stream
    streamIndex = 0;
    audio.pause();
    tryStream();
  }, 5 * 60_000);

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

// ── Hook ──

export function useAudio() {
  const [state, setState] = useState<AudioState>(loadState);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const layersRef = useRef<{
    ocean: AmbientLayer | null;
    sonar: AmbientLayer | null;
    radio: AmbientLayer | null;
  }>({ ocean: null, sonar: null, radio: null });

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

    // Ocean
    if (state.oceanEnabled && !layers.ocean) {
      layers.ocean = createOceanLayer(ctx, master);
    } else if (!state.oceanEnabled && layers.ocean) {
      layers.ocean.stop();
      layers.ocean = null;
    }

    // Sonar
    if (state.sonarEnabled && !layers.sonar) {
      layers.sonar = createSonarLayer(ctx, master);
    } else if (!state.sonarEnabled && layers.sonar) {
      layers.sonar.stop();
      layers.sonar = null;
    }

    // Radio
    if (state.radioEnabled && !layers.radio) {
      layers.radio = createRadioLayer(ctx, master, state.volume);
    } else if (!state.radioEnabled && layers.radio) {
      layers.radio.stop();
      layers.radio = null;
    }

    return () => {
      teardownAll();
    };
  }, [state.enabled, state.oceanEnabled, state.sonarEnabled, state.radioEnabled]);

  // Update master volume (and radio which uses its own volume control)
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.setValueAtTime(state.volume, ctxRef.current?.currentTime ?? 0);
    }
    if (layersRef.current.radio?.setVolume) {
      layersRef.current.radio.setVolume(state.volume);
    }
  }, [state.volume]);

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
    setState(s => ({ ...s, oceanEnabled: !s.oceanEnabled }));
  }, []);

  const toggleSonar = useCallback(() => {
    setState(s => ({ ...s, sonarEnabled: !s.sonarEnabled }));
  }, []);

  const toggleRadio = useCallback(() => {
    setState(s => ({ ...s, radioEnabled: !s.radioEnabled }));
  }, []);

  const toggleUiSounds = useCallback(() => {
    setState(s => ({ ...s, uiSoundsEnabled: !s.uiSoundsEnabled }));
  }, []);

  return {
    ...state,
    toggle,
    setVolume,
    toggleOcean,
    toggleSonar,
    toggleRadio,
    toggleUiSounds,
    playSound,
  };
}
