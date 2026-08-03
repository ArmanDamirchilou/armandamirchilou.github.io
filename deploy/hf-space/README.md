---
title: Arman Digital Twin API
emoji: 🗣️
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Arman's Digital Twin — backend API

Serves the brain and voice for [armandamirchilou.github.io](https://armandamirchilou.github.io).
The website itself is a static GitHub Pages build; this Space is the part that
has to actually run something.

## Endpoints

| Method | Path                      | Purpose                                     |
| ------ | ------------------------- | ------------------------------------------- |
| `GET`  | `/api/health`             | Status, active LLM provider, voice state    |
| `POST` | `/api/chat`               | `{ message, history }` → reply + audio URL  |
| `GET`  | `/audio/<file>`           | Generated speech clips                      |

## Voice

XTTS v2 runs alongside the API and clones the reference sample in
`voice/arman_voice_sample.wav`. On free CPU hardware a reply takes roughly
10–20 seconds. If the model fails to load, the API falls back to Edge TTS
automatically, so the twin keeps talking in a stock voice rather than falling
silent.

## Secrets

Set these in **Settings → Variables and secrets**:

- `OPENROUTER_API_KEY` — required, drives the replies
- `OPENROUTER_MODELS` — optional, comma-separated fallback list
- `TTS_MODE` — `clone` (default here) or `edge` to skip XTTS entirely
