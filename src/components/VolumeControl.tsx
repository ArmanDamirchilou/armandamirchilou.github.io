import { useState } from 'react';

interface VolumeControlProps {
  volume: number;
  onChange: (v: number) => void;
}

/**
 * Floating neo-brutalist volume control: a speaker button that mutes/unmutes,
 * plus a chunky slider whose fill tracks the level. Sits over the avatar stage.
 */
export function VolumeControl({ volume, onChange }: VolumeControlProps) {
  const [lastNonZero, setLastNonZero] = useState(volume || 1);
  const muted = volume === 0;

  const toggleMute = () => {
    if (muted) {
      onChange(lastNonZero || 1);
    } else {
      setLastNonZero(volume);
      onChange(0);
    }
  };

  const pct = Math.round(volume * 100);

  return (
    <div className="volume-control" style={{ ['--vol' as string]: `${pct}%` }}>
      <button
        className="volume-btn"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute voice' : 'Mute voice'}
        aria-pressed={muted}
      >
        {muted ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" stroke="none" />
            <path d="m17 9 5 6M22 9l-5 6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" stroke="none" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
          </svg>
        )}
      </button>
      <input
        className="volume-slider"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label="Voice volume"
      />
      <span className="volume-readout">{pct}</span>
    </div>
  );
}
