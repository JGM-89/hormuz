import { useRef, useCallback, useEffect, useState } from 'react';

// Marine VHF radio streams from Broadcastify (public feeds)
const MARINE_STREAMS = [
  'https://broadcastify.cdnstream1.com/17329', // NJ/NY marine VHF
  'https://broadcastify.cdnstream1.com/35475', // VHF CH 16, 67, 61
];

interface AudioState {
  enabled: boolean;
  ambientEnabled: boolean;
  uiSoundsEnabled: boolean;
  volume: number;
}

export function useAudio() {
  const [state, setState] = useState<AudioState>(() => {
    const stored = localStorage.getItem('hormuz-audio');
    if (stored) {
      try { return JSON.parse(stored); } catch { /* ignore */ }
    }
    return { enabled: false, ambientEnabled: true, uiSoundsEnabled: true, volume: 0.3 };
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  // Persist state
  useEffect(() => {
    localStorage.setItem('hormuz-audio', JSON.stringify(state));
  }, [state]);

  // Manage ambient audio stream
  useEffect(() => {
    if (state.enabled && state.ambientEnabled) {
      if (!audioRef.current) {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.loop = true;

        // Try each stream, fall back to next
        let streamIndex = 0;
        const tryStream = () => {
          if (streamIndex < MARINE_STREAMS.length) {
            audio.src = MARINE_STREAMS[streamIndex];
            audio.play().catch(() => {
              streamIndex++;
              tryStream();
            });
          }
        };

        audio.onerror = () => {
          streamIndex++;
          tryStream();
        };

        // Set up Web Audio API for volume control
        try {
          const ctx = new AudioContext();
          const source = ctx.createMediaElementSource(audio);
          const gain = ctx.createGain();
          gain.gain.value = state.volume;
          source.connect(gain);
          gain.connect(ctx.destination);
          audioCtxRef.current = ctx;
          gainRef.current = gain;
        } catch {
          // Fallback: just use audio volume
          audio.volume = state.volume;
        }

        audioRef.current = audio;
        tryStream();
      }
    } else {
      // Stop ambient
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
        gainRef.current = null;
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [state.enabled, state.ambientEnabled]);

  // Update volume
  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = state.volume;
    } else if (audioRef.current) {
      audioRef.current.volume = state.volume;
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

  const toggleAmbient = useCallback(() => {
    setState(s => ({ ...s, ambientEnabled: !s.ambientEnabled }));
  }, []);

  const toggleUiSounds = useCallback(() => {
    setState(s => ({ ...s, uiSoundsEnabled: !s.uiSoundsEnabled }));
  }, []);

  return {
    ...state,
    toggle,
    setVolume,
    toggleAmbient,
    toggleUiSounds,
    playSound,
  };
}
