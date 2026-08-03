#!/usr/bin/env bash
# XTTS goes to the background: loading the model takes a while, and the API
# must start answering immediately either way. tts.ts falls back to Edge TTS
# whenever :5050 isn't ready, so a slow or failed load degrades the voice
# rather than taking the twin down.
set -u

python voice/clone_server.py &
XTTS_PID=$!
echo "[start] XTTS starting (pid $XTTS_PID) on :5050"

# If the API exits, take the whole container with it so the Space restarts.
trap 'kill $XTTS_PID 2>/dev/null' EXIT

echo "[start] API listening on :${PORT:-7860}"
exec node dist-server/index.js
