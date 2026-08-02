import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const SECTIONS = [
  { id: 'top', label: 'PORTFOLIO' },
  { id: 'work', label: 'WORK' },
  { id: 'journey', label: 'JOURNEY' },
  { id: 'about', label: 'ABOUT' },
  { id: 'twin', label: 'TWIN' },
];

/**
 * The reference site's floating frosted pill navigation — the only persistent
 * UI element. Shows the current section, arrows step between sections, and the
 * plus button opens the live twin.
 */
export function PillNav() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = SECTIONS.findIndex((s) => s.id === entry.target.id);
          if (i !== -1) setActive(i);
        }
      },
      { rootMargin: '-45% 0px -45% 0px' }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const go = (i: number) => {
    const clamped = Math.max(0, Math.min(SECTIONS.length - 1, i));
    document.getElementById(SECTIONS[clamped].id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="pill-nav" aria-label="Sections">
      <span className="pill-thumb" aria-hidden>A</span>
      <span className="pill-label-group">
        <span className="pill-sublabel">Section</span>
        <span className="pill-label">{SECTIONS[active].label}</span>
      </span>
      <button
        className="pill-arrow"
        onClick={() => go(active - 1)}
        disabled={active === 0}
        aria-label="Previous section"
      >
        ←
      </button>
      <button
        className="pill-arrow"
        onClick={() => go(active + 1)}
        disabled={active === SECTIONS.length - 1}
        aria-label="Next section"
      >
        →
      </button>
      <Link to="/twin" className="pill-plus" aria-label="Open the live AI twin">+</Link>
    </nav>
  );
}
