# Backend for Arman's digital twin, built for a Liara Docker app.
#
# Runs the Express API (public) and, if the plan has enough RAM, the XTTS voice
# clone server on :5050 alongside it. server/tts.ts falls back to Edge TTS
# whenever :5050 is not ready, so a small plan still gets a talking twin —
# just not in the cloned voice.

FROM python:3.10-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    # XTTS v2 is CPML-licensed and blocks on an interactive prompt without this.
    COQUI_TOS_AGREED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates gnupg build-essential espeak-ng ffmpeg \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# CPU-only torch: the CUDA wheels are ~2 GB and useless without a GPU.
RUN pip install --no-cache-dir \
      torch==2.1.2 torchaudio==2.1.2 \
      --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Bake the XTTS weights in so the first reply isn't a 2 GB download.
RUN python -c "from TTS.api import TTS; TTS('tts_models/multilingual/multi-dataset/xtts_v2')"

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.server.json ./
COPY server ./server
COPY personality ./personality
COPY voice ./voice
RUN npm run build:server && npm prune --omit=dev

RUN mkdir -p public/audio

COPY start.sh ./
RUN chmod +x start.sh

# Liara injects PORT; default to its usual 3000 for local docker runs.
ENV PORT=3000 \
    TTS_MODE=clone
EXPOSE 3000

CMD ["./start.sh"]
