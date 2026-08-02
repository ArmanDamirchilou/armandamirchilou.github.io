// Shared scroll state, updated by <SmoothScroll/> and read inside the R3F
// render loop (useFrame) so the 3D hero reacts to scroll without React re-renders.
export const scrollState = {
  /** raw window scrollY in px */
  y: 0,
  /** 0 → 1 across the whole page */
  progress: 0,
  /** 0 → 1 across the first viewport (the hero) */
  heroProgress: 0,
};
