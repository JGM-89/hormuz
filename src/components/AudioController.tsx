import { useState, useRef, useEffect } from 'react';
import { useAudio } from '../hooks/useAudio';

export default function AudioController() {
  const audio = useAudio();
  const [showPanel, setShowPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    if (!showPanel) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPanel]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Toggle button */}
      <button
        onClick={() => {
          if (!audio.enabled) {
            audio.toggle();
          } else {
            setShowPanel(!showPanel);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (audio.enabled) audio.toggle();
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border transition-colors ${
          audio.enabled
            ? 'bg-accent/10 border-accent/30 text-accent hover:bg-accent/15'
            : 'bg-surface-1 border-border text-text-dim hover:text-text-secondary hover:border-border'
        }`}
        title={audio.enabled ? 'Audio settings (right-click to mute)' : 'Enable audio'}
        aria-label={audio.enabled ? 'Audio enabled — click for settings' : 'Enable audio'}
      >
        {audio.enabled ? (
          <SpeakerOnIcon />
        ) : (
          <SpeakerOffIcon />
        )}
        <span className="text-[10px] font-semibold uppercase tracking-widest hidden sm:inline">
          {audio.enabled ? 'AUDIO' : 'MUTED'}
        </span>
      </button>

      {/* Settings panel */}
      {showPanel && audio.enabled && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-surface-0 border border-border rounded-sm shadow-lg z-50 animate-fade-in">
          <div className="p-2.5 space-y-2.5">
            {/* Master volume */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="label-caps">Volume</span>
                <span className="text-[10px] font-data text-text-dim">{Math.round(audio.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(audio.volume * 100)}
                onChange={(e) => audio.setVolume(Number(e.target.value) / 100)}
                className="w-full h-1 bg-surface-2 rounded-sm appearance-none cursor-pointer accent-accent"
                aria-label="Master volume"
              />
            </div>

            {/* Ambient toggle */}
            <ToggleRow
              label="VHF Radio"
              sublabel="Marine radio chatter"
              enabled={audio.ambientEnabled}
              onToggle={audio.toggleAmbient}
            />

            {/* UI sounds toggle */}
            <ToggleRow
              label="UI Sounds"
              sublabel="Pings & alerts"
              enabled={audio.uiSoundsEnabled}
              onToggle={audio.toggleUiSounds}
            />

            {/* Test sound */}
            <button
              onClick={() => audio.playSound('ping')}
              className="w-full text-[10px] text-text-dim hover:text-accent uppercase tracking-wider font-semibold py-1.5 rounded-sm hover:bg-surface-1 transition-colors"
            >
              ▶ Test Ping
            </button>
          </div>

          {/* Mute button */}
          <div className="border-t border-border-dim px-2.5 py-2">
            <button
              onClick={() => { audio.toggle(); setShowPanel(false); }}
              className="w-full text-[10px] text-status-crit hover:text-status-crit/80 uppercase tracking-wider font-semibold py-1 rounded-sm hover:bg-surface-1 transition-colors"
            >
              Mute All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, sublabel, enabled, onToggle }: {
  label: string;
  sublabel: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full py-1 group"
      aria-label={`${label}: ${enabled ? 'on' : 'off'}`}
    >
      <div>
        <div className="text-[11px] text-text-primary font-medium text-left">{label}</div>
        <div className="text-[9px] text-text-dim text-left">{sublabel}</div>
      </div>
      <div
        className={`w-7 h-4 rounded-sm relative transition-colors ${
          enabled ? 'bg-accent' : 'bg-surface-2'
        }`}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 rounded-sm bg-white transition-transform ${
            enabled ? 'left-3.5' : 'left-0.5'
          }`}
        />
      </div>
    </button>
  );
}

function SpeakerOnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5.5h2.5L8 2.5v11l-3.5-3H2a.5.5 0 01-.5-.5V6a.5.5 0 01.5-.5z" fill="currentColor" />
      <path d="M10.5 4.5a4.5 4.5 0 010 7M12 2.5a7 7 0 010 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5.5h2.5L8 2.5v11l-3.5-3H2a.5.5 0 01-.5-.5V6a.5.5 0 01.5-.5z" fill="currentColor" />
      <path d="M11 5.5l4 5M15 5.5l-4 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
