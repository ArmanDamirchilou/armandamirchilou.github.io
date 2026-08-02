import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Reference loading screen: white viewport, centered hairline circle whose arc
 * draws clockwise as a progress ring, with the name (serif) and a counting
 * percentage (sans) stacked motionless at the center. Holds briefly at 100%,
 * then fades out. Progress eases toward 100 over ~2.2s and waits for fonts.
 */
export function Preloader() {
  const reduce = useReducedMotion();
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [pct, setPct] = useState(0);
  const arcRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (reduce) {
      setGone(true);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const DURATION = 2200;
    let fontsReady = false;
    document.fonts?.ready.then(() => { fontsReady = true; });

    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / DURATION);
      // ease-out toward 99, only complete once fonts are in
      const eased = 1 - Math.pow(1 - t, 3);
      let p = Math.round(eased * 99);
      if (t >= 1 && fontsReady) p = 100;
      setPct(p);
      if (arcRef.current) {
        arcRef.current.style.strokeDashoffset = String(100 - p);
      }
      if (p >= 100) {
        setTimeout(() => setLeaving(true), 350);
        setTimeout(() => setGone(true), 1050);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  if (gone) return null;

  return (
    <div className={`preloader ${leaving ? 'leaving' : ''}`} aria-hidden>
      <svg className="preloader-ring" viewBox="0 0 100 100">
        {/* faint full track */}
        <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="0.4" />
        {/* progress arc — draws clockwise from the top */}
        <circle
          ref={arcRef}
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="#000"
          strokeWidth="0.6"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset="100"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="preloader-center">
        <span className="preloader-name">Arman Damirchilou</span>
        <span className="preloader-pct">{pct}%</span>
      </div>
    </div>
  );
}
