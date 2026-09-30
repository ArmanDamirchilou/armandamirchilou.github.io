/**
 * One drawn motif per project, in place of screenshots that don't exist. Each
 * is a diagram of what the system does (lanes for traffic, a waveform for
 * voice), not a fake UI. Animation is CSS-only and stops under reduced motion.
 */
export function ProjectArt({ id }: { id: string }) {
  switch (id) {
    case 'rag':
      return (
        <svg viewBox="0 0 400 300" className="art art-rag" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <g key={i} transform={`translate(${60 + i * 8} ${40 + i * 30})`}>
              <rect width={220 - i * 6} height="18" rx="4" className={i === 3 ? 'art-hit' : 'art-line'} />
            </g>
          ))}
          <rect x="40" y="0" width="300" height="3" className="art-scan" />
        </svg>
      );
    case 'traffic':
      return (
        <svg viewBox="0 0 400 300" className="art art-traffic" aria-hidden>
          <path d="M0 150H400M200 0V300" className="art-road" />
          <path d="M0 150H400M200 0V300" className="art-lane" />
          {[0, 1, 2].map((i) => (
            <circle key={`h${i}`} r="7" cy="140" className="art-car h" style={{ animationDelay: `${i * -1.3}s` }} />
          ))}
          {[0, 1].map((i) => (
            <circle key={`v${i}`} r="7" cx="210" className="art-car v" style={{ animationDelay: `${i * -2}s` }} />
          ))}
          <circle cx="200" cy="150" r="22" className="art-signal" />
        </svg>
      );
    case 'water':
      return (
        <svg viewBox="0 0 400 300" className="art art-water" aria-hidden>
          {/* The offset lives on the group: a CSS transform on the path would
              replace an SVG transform attribute, not add to it. */}
          {[0, 1, 2, 3].map((i) => (
            <g key={i} transform={`translate(0 ${110 + i * 42})`}>
              <path
                className={`art-wave w${i}`}
                d="M-400 0 Q-350 -22 -300 0 T-200 0 T-100 0 T0 0 T100 0 T200 0 T300 0 T400 0 T500 0 T600 0 T700 0 T800 0"
              />
            </g>
          ))}
        </svg>
      );
    case 'voice':
      return (
        <svg viewBox="0 0 400 300" className="art art-voice" aria-hidden>
          {Array.from({ length: 34 }, (_, i) => {
            const h = 20 + Math.abs(Math.sin(i * 0.7) * 90) + (i % 5) * 6;
            return (
              <rect
                key={i}
                x={36 + i * 10}
                y={150 - h / 2}
                width="5"
                height={h}
                rx="2.5"
                className={i >= 20 && i <= 24 ? 'art-hit bar' : 'art-line bar'}
                style={{ animationDelay: `${(i % 7) * -0.18}s` }}
              />
            );
          })}
        </svg>
      );
    case 'art':
      return (
        <svg viewBox="0 0 400 300" className="art art-emotion" aria-hidden>
          <defs>
            <filter id="art-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="18" />
            </filter>
          </defs>
          <g filter="url(#art-soft)">
            <circle cx="160" cy="140" r="80" className="art-blob a" />
            <circle cx="245" cy="165" r="70" className="art-blob b" />
            <circle cx="200" cy="110" r="46" className="art-blob c" />
          </g>
          <text x="200" y="265" textAnchor="middle" className="art-caption">"quietly hopeful"</text>
        </svg>
      );
    case 'rl':
      return (
        <svg viewBox="0 0 400 300" className="art art-rl" aria-hidden>
          {Array.from({ length: 8 }, (_, r) =>
            Array.from({ length: 11 }, (_, c) => (
              <circle key={`${r}-${c}`} cx={50 + c * 30} cy={45 + r * 30} r="2" className="art-dot" />
            ))
          )}
          <path d="M50 255 H140 V165 H200 V105 H290 V45 H350" className="art-path" />
          <circle cx="350" cy="45" r="9" className="art-hit" />
        </svg>
      );
    default:
      return null;
  }
}
