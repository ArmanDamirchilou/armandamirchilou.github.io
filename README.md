# Arman's Digital Twin — Virtual Avatar System

A complete interactive virtual avatar that simulates appearance, voice, thinking style, and personality using real-time 3D rendering, AI conversation, and voice synthesis.

## Quick Start

```bash
# 1. Install web dependencies
npm install

# 2. (Optional) add a Gemini key in .env for dynamic AI answers
#    GEMINI_API_KEY=AIza...   (get one at https://aistudio.google.com/apikey)
#    Without it, the avatar uses built-in personality responses.

# 3a. Run WITHOUT voice cloning (uses free Edge TTS):
npm run dev
#     Open http://localhost:5173

# 3b. Run WITH your cloned voice (recommended):
#     Terminal 1 - start the local voice model (loads XTTS on your GPU):
npm run voice
#     Terminal 2 - start the web app:
npm run dev
#     Or run all three at once:
npm run dev:full
```

### Voice cloning setup (one time)

```bash
# GPU (CUDA 11.8) PyTorch, then the pinned TTS stack:
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install -r voice/requirements.txt
```

`.env` controls the voice: `TTS_MODE=clone` uses your real voice via the local
XTTS server; if that server is down it automatically falls back to Edge TTS so
the site is never silent. The voice server caches your speaker latents at
startup, so replies take only a few seconds on an RTX-class GPU.

> **Real mouth movement:** the current `model.glb` has no facial blendshapes,
> so the lips can't part. See [docs/REAL_LIPSYNC.md](docs/REAL_LIPSYNC.md) for the
> 5-minute fix (re-export from Avaturn with ARKit blendshapes). The lip-sync
> engine is already wired to drive them automatically once present.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌─────────────────────┐   ┌──────────────────────────────┐ │
│  │   Three.js Scene     │   │     Chat Interface           │ │
│  │                      │   │                              │ │
│  │  ┌────────────────┐  │   │  Text/Voice Input            │ │
│  │  │  Avatar Model   │  │   │       ↓                      │ │
│  │  │  (Avaturn GLB)  │  │   │  API Call → Server           │ │
│  │  │                 │  │   │       ↓                      │ │
│  │  │  Procedural     │  │   │  AI Response                 │ │
│  │  │  Animations:    │  │   │       ↓                      │ │
│  │  │  - Breathing    │  │   │  TTS (ElevenLabs / Browser)  │ │
│  │  │  - Idle motion  │  │   │       ↓                      │ │
│  │  │  - Head drift   │  │   │  Audio → Lip-sync Analyzer   │ │
│  │  │  - Lip-sync     │  │   │       ↓                      │ │
│  │  │  - Gestures     │  │   │  Animation Params → Avatar   │ │
│  │  └────────────────┘  │   │                              │ │
│  └─────────────────────┘   └──────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Express Server     │
                    │                      │
                    │  POST /api/chat      │
                    │    ├─ Personality     │
                    │    ├─ Claude LLM      │
                    │    ├─ Memory          │
                    │    └─ ElevenLabs TTS  │
                    └─────────────────────┘
```

## Features

### 3D Avatar
- Real-time rendering with Three.js + React Three Fiber
- PBR materials with cinematic lighting (key, fill, rim)
- Environment mapping and contact shadows
- Orbit camera controls

### Procedural Animation
- Natural breathing cycle
- Idle body sway and weight shifting
- Head drift and micro-movements
- Speech-synced head nodding and gestures
- Audio-reactive body language

### AI Personality
- Claude API integration with deep personality system
- Custom knowledge base (edit `personality/knowledge-base.json`)
- Conversation memory across the session
- 10+ pre-built sample responses that match your style
- Graceful fallback when API keys aren't configured

### Voice
- ElevenLabs voice cloning (with your custom voice ID)
- Browser Web Speech API fallback (works without API keys)
- Real-time audio analysis for lip-sync animation
- Speech recognition for voice input (Chrome/Edge)

## Configuration

### API Keys (`.env`)

| Key | Purpose | Required? |
|-----|---------|-----------|
| `ANTHROPIC_API_KEY` | AI conversation via Claude | Optional — falls back to scripted responses |
| `ELEVENLABS_API_KEY` | Voice cloning via ElevenLabs | Optional — falls back to browser TTS |
| `ELEVENLABS_VOICE_ID` | Your cloned voice ID | Required for ElevenLabs |

### Personality Customization

Edit these files to make the avatar match your personality:

- **`personality/system-prompt.md`** — Core personality traits, speaking style, rules
- **`personality/knowledge-base.json`** — Facts, skills, projects, sample Q&A responses

### 3D Model

Replace `public/model.glb` with your own Avaturn or Ready Player Me model.
The system auto-detects the skeleton and applies procedural animations.

## Project Structure

```
├── public/model.glb           # Avatar 3D model
├── personality/               # Personality data
│   ├── system-prompt.md       # AI character definition
│   └── knowledge-base.json    # Facts and sample responses
├── server/                    # Backend
│   ├── index.ts               # Express server
│   ├── llm.ts                 # Claude API integration
│   ├── tts.ts                 # ElevenLabs TTS
│   ├── personality.ts         # Personality loader
│   └── memory.ts              # Conversation memory
├── src/                       # Frontend
│   ├── App.tsx                # Main app
│   ├── components/
│   │   ├── Avatar.tsx         # 3D model + animation
│   │   ├── AvatarScene.tsx    # Three.js scene setup
│   │   └── ChatInterface.tsx  # Chat UI
│   ├── systems/
│   │   ├── AnimationSystem.ts # Procedural animation engine
│   │   └── LipSync.ts        # Audio analysis for lip-sync
│   └── hooks/
│       ├── useChat.ts         # Chat state management
│       ├── useAudio.ts        # Audio playback + analysis
│       └── useVoiceInput.ts   # Speech recognition
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both client (5173) and server (3001) |
| `npm run dev:client` | Start only the frontend |
| `npm run dev:server` | Start only the backend |
| `npm run build` | Production build |

## System Requirements

- **Node.js** 18+
- **Browser**: Chrome or Edge recommended (for voice input)
- **GPU**: Any modern GPU (integrated is fine for WebGL)
- **RAM**: 4GB minimum

## Upgrading

### Adding Voice Cloning
1. Sign up at [ElevenLabs](https://elevenlabs.io/)
2. Clone your voice using their voice lab
3. Copy your API key and Voice ID to `.env`

### Adding AI Conversations
1. Get an API key from [Anthropic Console](https://console.anthropic.com/)
2. Add it to `.env` as `ANTHROPIC_API_KEY`

### Adding Morph Targets (Blendshapes)
For full facial animation, re-export your avatar from Avaturn with ARKit blendshapes enabled, or add them in Blender. The animation system will auto-detect and use them.
