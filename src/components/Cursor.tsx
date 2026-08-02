import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Reference detail: a small grey rounded-rectangle cursor ghost that trails
 * the pointer over interactive zones (elements marked data-cursor). Pure DOM,
 * rAF lerp, hidden on touch devices and under reduced motion.
 */
export function Cursor() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduce) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const el = ref.current;
    if (!el) return;

    let x = -100, y = -100, tx = -100, ty = -100;
    let visible = false;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      const over = (e.target as Element | null)?.closest?.('[data-cursor]') != null;
      if (over !== visible) {
        visible = over;
        el.style.opacity = over ? '1' : '0';
      }
    };

    const loop = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      el.style.transform = `translate(${x - 10}px, ${y - 14}px)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  if (reduce) return null;
  return <div ref={ref} className="cursor-ghost" aria-hidden />;
}
