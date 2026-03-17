import { useState, useRef, useEffect } from 'react';
import { useAudio, MARINE_STREAMS } from '../hooks/useAudio';
import { Volume2, VolumeX, Waves, Radio, Zap, Megaphone } from 'lucide-react';

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
          <Volume2 size={14} />
        ) : (
          <VolumeX size={14} />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-widest hidden sm:inline">
          {audio.enabled ? 'AUDIO' : 'MUTED'}
        </span>
      </button>

      {/* Settings panel */}
      {showPanel && audio.enabled && (
        <div className="absolute top-full right-0 mt-1 w-60 bg-surface-0 border border-border rounded-sm shadow-lg z-50 animate-fade-in">
          <div className="p-3 space-y-3">
            {/* Master volume */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="label-caps">Master Volume</span>
                <span className="text-[11px] font-data text-text-dim">{Math.round(audio.volume * 100)}%</span>
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

            {/* Ambient section header */}
            <div className="label-caps text-text-dim pt-1">Ambient Layers</div>

            {/* Ambience (ocean + sonar combined) */}
            <ToggleRow
              icon={<Waves size={13} />}
              label="Ambience"
              sublabel="Sea state, static & sonar"
              enabled={audio.oceanEnabled}
              onToggle={audio.toggleOcean}
            />

            {/* Ambience volume slider */}
            {audio.oceanEnabled && (
              <div className="pl-7">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-text-dim">Volume</span>
                  <span className="text-[10px] font-data text-text-dim">{Math.round(audio.ambienceVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(audio.ambienceVolume * 100)}
                  onChange={(e) => audio.setAmbienceVolume(Number(e.target.value) / 100)}
                  className="w-full h-1 bg-surface-2 rounded-sm appearance-none cursor-pointer accent-accent"
                  aria-label="Ambience volume"
                />
              </div>
            )}

            {/* Marine radio */}
            <ToggleRow
              icon={<Radio size={13} />}
              label="Marine VHF"
              sublabel="Live shipping radio"
              enabled={audio.radioEnabled}
              onToggle={audio.toggleRadio}
            />

            {/* VHF volume slider */}
            {audio.radioEnabled && (
              <div className="pl-7 mb-1">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-text-dim">Volume</span>
                  <span className="text-[10px] font-data text-text-dim">{Math.round(audio.radioVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(audio.radioVolume * 100)}
                  onChange={(e) => audio.setRadioVolume(Number(e.target.value) / 100)}
                  className="w-full h-1 bg-surface-2 rounded-sm appearance-none cursor-pointer accent-accent"
                  aria-label="VHF radio volume"
                />
              </div>
            )}

            {/* Feed selector — only visible when radio is on */}
            {audio.radioEnabled && (
              <div className="pl-7">
                <select
                  value={audio.radioStreamIndex}
                  onChange={(e) => audio.setRadioStream(Number(e.target.value))}
                  className="w-full text-[10px] bg-surface-2 text-text-secondary border border-border-dim rounded-sm px-1.5 py-1 cursor-pointer focus:outline-none focus:border-accent appearance-none"
                  aria-label="Select VHF feed"
                >
                  <option value={-1}>Auto (best available)</option>
                  {MARINE_STREAMS.map((s, i) => (
                    <option key={s.url} value={i}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Shipping forecast */}
            <ToggleRow
              icon={<Megaphone size={13} />}
              label="Forecast"
              sublabel="Spoken shipping forecast"
              enabled={audio.forecastEnabled}
              onToggle={audio.toggleForecast}
            />

            {/* Speak now button — only visible when forecast is on */}
            {audio.forecastEnabled && (
              <div className="pl-7">
                <button
                  onClick={() => audio.speakForecastNow()}
                  className="w-full text-[10px] text-text-dim hover:text-accent uppercase tracking-wider font-semibold py-1 rounded-sm hover:bg-surface-1 transition-colors text-left"
                >
                  ▶ Speak Now
                </button>
              </div>
            )}

            {/* Divider */}
            <div className="h-px bg-border-dim" />

            {/* UI sounds */}
            <ToggleRow
              icon={<Zap size={13} />}
              label="UI Sounds"
              sublabel="Pings & alerts"
              enabled={audio.uiSoundsEnabled}
              onToggle={audio.toggleUiSounds}
            />

            {/* Test sound */}
            <button
              onClick={() => audio.playSound('ping')}
              className="w-full text-[11px] text-text-dim hover:text-accent uppercase tracking-wider font-semibold py-1.5 rounded-sm hover:bg-surface-1 transition-colors"
            >
              ▶ Test Ping
            </button>
          </div>

          {/* Mute button */}
          <div className="border-t border-border-dim px-3 py-2">
            <button
              onClick={() => { audio.toggle(); setShowPanel(false); }}
              className="w-full text-[11px] text-status-crit hover:text-status-crit/80 uppercase tracking-wider font-semibold py-1 rounded-sm hover:bg-surface-1 transition-colors"
            >
              Mute All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ icon, label, sublabel, enabled, onToggle }: {
  icon: React.ReactNode;
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
      <div className="flex items-center gap-2">
        <span className={`${enabled ? 'text-accent' : 'text-text-dim'} transition-colors`}>
          {icon}
        </span>
        <div>
          <div className="text-xs text-text-primary font-medium text-left">{label}</div>
          <div className="text-[10px] text-text-dim text-left">{sublabel}</div>
        </div>
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
