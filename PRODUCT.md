# PRODUCT.md

## What this is
Personal portfolio + live AI twin for **Arman Damirchilou** — a teenage AI software engineer from Tehran, Iran (b. 2010 — writing Python since 11, deep in AI since 13). International medalist (Gold, Innoverse Expo US 2025; 2nd, Iran National AI Cup 2024; more). The site presents his work and lets visitors talk to a real-time 3D avatar that answers in his cloned voice (`/twin`).

## Register
`brand` — this is a portfolio; design IS the product. A visitor should leave thinking "this person has extraordinary taste and shipped something alive."

## Audience
University admissions, research labs, collaborators, press. Viewed on desktop first (large-screen gallery experience), must hold up on mobile.

## Design direction (locked by the owner)
Exact-replica adaptation of **aikawakenichi.com** (studio: Garden Eight). Ground-truth tokens extracted from the live site's CSS:

- **Color: pure monochrome.** `#000` ink on `#fff`. No accent color. One inverted (black) section allowed for rhythm.
- **Type:** reference uses PP Neue Montreal (sans 400/600) + PP Editorial Old (serif 400). Free equivalents in use: **Hanken Grotesk** (sans) + **EB Garamond** (serif, incl. italic). Giant serif display (~12–17vw) for section titles/name; small 14–16px sans for everything else.
- **Motion:** signature easing `cubic-bezier(.104,.204,.492,1)`. Masked line reveals (translateY 110% → 0), underline-grow hovers (scaleX 0 → 1, origin left), slow drifts. Lenis smooth scroll.
- **Signature details:** fixed scroll-progress percentage (bottom-left), live clock `HH:MM:SS TEHRAN` in footer (reference shows JST), hairline rules `rgba(0,0,0,.14)`, obfuscated-style email display.
- **Hard constraint from owner: zero emojis anywhere.** SVG icons only.

## Pages
- `/` — hero (giant serif name + floating 3D avatar portrait → links to /twin), Work (typographic project index), Journey (award timeline), About, AI Twin invitation (inverted), footer/contact.
- `/twin` — full-screen AI twin: 3D avatar stage + chat. GPT-4o-mini responses, local XTTS v2 voice clone (port 5050 via Express on 3001), audio-driven lip-sync (pending a model export with blendshapes).

## Tech
React 19 + TypeScript + Vite; React Three Fiber + drei; framer-motion; lenis; Express server (`server/index.ts`); Coqui XTTS v2 (`voice/clone_server.py`). Avatar: Avaturn GLB (Mixamo skeleton) at `public/model.glb`.
