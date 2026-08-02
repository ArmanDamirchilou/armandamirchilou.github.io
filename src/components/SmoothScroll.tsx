import { useEffect } from 'react';
import Lenis from 'lenis';
import { scrollState } from '../lib/scroll';

/**
 * Site-wide buttery smooth scrolling (Lenis) + publishes scroll progress into
 * scrollState so the 3D hero can scrub to scroll. Mount once, near the page root.
 */
export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const vh = window.innerHeight || 1;
      scrollState.y = window.scrollY;
      scrollState.progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      scrollState.heroProgress = Math.min(1, window.scrollY / vh);
    };

    lenis.on('scroll', update);
    update();

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
