import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | null = null;

/** Smooth-scrolls to an in-page anchor (or the top), with or without Lenis. */
export function scrollToTarget(target: string | number) {
  if (lenis) {
    lenis.scrollTo(target, { offset: 0, duration: 1.4 });
    return;
  }
  if (typeof target === 'number') window.scrollTo({ top: target, behavior: 'smooth' });
  else document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Lenis smooth scrolling driven by GSAP's ticker, so ScrollTrigger reads the
 * same scroll position Lenis renders. Two separate rAF loops drift a frame
 * apart, which is exactly the jitter pinned sections show.
 */
export function useSmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const l = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis = l;
    l.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => l.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      l.destroy();
      if (lenis === l) lenis = null;
    };
  }, []);
}
