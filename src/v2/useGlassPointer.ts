import { useEffect } from 'react';

/**
 * Makes the highlight on glass panes (.lg) follow the pointer. One listener
 * for the whole page: it only touches the pane under the cursor, once a frame.
 */
export function useGlassPointer() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover)').matches) return;
    let raf = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      raf = 0;
      const e = last;
      if (!e) return;
      const pane = (e.target as Element | null)?.closest?.<HTMLElement>('.lg');
      if (!pane) return;
      const r = pane.getBoundingClientRect();
      pane.style.setProperty('--mx', `${e.clientX - r.left}px`);
      pane.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    const onMove = (e: PointerEvent) => {
      last = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
}
