# PRODUCT.md

## What this is
Personal portfolio + live AI twin for **Arman Damirchilou**, a teenage AI software engineer from Tehran, Iran (b. 2010; writing Python since 11, deep in AI since 13). International medalist (Gold, Innoverse Expo US 2025; 2nd, Iran National AI Cup 2024; more). The site presents his work and lets visitors talk to a real-time 3D avatar of him (`/twin`).

## Register
`brand`: this is a portfolio; design IS the product. A visitor should leave thinking "this person has extraordinary taste and shipped something alive."

## Audience
University admissions first, then research labs, collaborators, press. Desktop first (large-screen scroll experience), must hold up on mobile. The `Profile` section exists for admissions readers: every fact they'd look for, on one screen.

## Design direction (v2, "Apple-style 3D scroll")
- **Color:** dark graphite ground `#0c0d0f`, bone text `#ecebe6`, muted `#8f9197`, hairlines `rgba(236,235,230,.12)`. Exactly one accent: pomegranate `#e0484f` (a Persian symbol). One theme per page, no light sections.
- **Type:** Geist Variable (display + body, tight negative tracking on display) and Geist Mono for meta labels. Self-hosted via @fontsource, no font CDN.
- **Signature effect:** the hero pins a live 3D portrait whose camera orbits with scroll while three statements swap. Everything else is quiet: word-by-word manifesto reveal, count-up stats, stacked project cards, a pinned horizontal journey track.
- **Motion:** GSAP ScrollTrigger + Lenis on GSAP's ticker. Every scroll effect has a `prefers-reduced-motion` fallback (static layout). Stacking and pinning only where the content fits the screen.
- **Copy rules:** no em-dashes, no emoji anywhere (hard constraint from the owner), headlines short, facts only from `personality/knowledge-base.json` and `src/v2/content.ts`.

## Pages
- `/`: v2 homepage (`src/pages/HomeV2.tsx`, styles `src/styles/v2.css`, content `src/v2/content.ts`).
- `/twin`: full-screen AI twin, 3D avatar + chat, in the same dark theme (`src/styles/twin-v2.css`). Voice via the backend's TTS (Kokoro on CPU hosts), spoken sentence by sentence; Stop button, Esc, mic or a new message interrupt it.
- `/contact`: mailto form + channels.
- `/classic`: the previous neo-brutalist homepage, kept live on purpose (also tagged `classic-v1`, branch `classic-site`).
- anything else: 404 page.

## Tech
React 19 + TypeScript + Vite; React Three Fiber + drei; GSAP + ScrollTrigger; Lenis; Express server (`server/index.ts`) with OpenRouter free models and pluggable TTS (`server/tts.ts`). Avatar GLB with ARKit blendshapes at `public/model.glb`.

## Tests
`npm test` (Vitest unit tests: speech chunking, reply cleanup, personality, sessions) and `npm run test:e2e` (Playwright against the production build, desktop + mobile, twin backend mocked).
