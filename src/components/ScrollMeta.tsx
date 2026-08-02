import { useEffect, useRef } from 'react';
import { scrollState } from '../lib/scroll';

/**
 * Fixed scroll-progress percentage, bottom-left — the reference site's meter.
 * Writes straight to the DOM node from a rAF loop; no React re-renders.
 */
export function ScrollMeta() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let last = -1;
    const loop = () => {
      const pct = Math.round(scrollState.progress * 100);
      if (pct !== last && ref.current) {
        ref.current.textContent = `${pct}%`;
        last = pct;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="scroll-meta" aria-hidden>
      <span ref={ref}>0%</span>
    </div>
  );
}
