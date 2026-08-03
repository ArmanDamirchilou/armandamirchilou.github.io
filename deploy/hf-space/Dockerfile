# Backend for Arman's digital twin, built for a Hugging Face Docker Space.
#
# Runs two processes: the Express API (public, on 7860) and the XTTS voice
# clone server (internal, on 5050). If XTTS fails to load, server/tts.ts
# already falls back to Edge TTS, so the twin still speaks — just not in the
# cloned voice. That makes the clone a bonus rather than a hard dependency.

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

# Spaces run as uid 1000; caches and generated audio must live somewhere writable.
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    TTS_HOME=/home/user/.local/share/tts \
    HF_HOME=/home/user/.cache/huggingface \
    NUMBA_CACHE_DIR=/tmp/numba
USER user
WORKDIR /app

# CPU-only torch: the CUDA wheels are ~2 GB and useless on a free CPU Space.
RUN pip install --no-cache-dir --user \
      torch==2.1.2 torchaudio==2.1.2 \
      --index-url https://download.pytorch.org/whl/cpu
COPY --chown=user requirements.txt ./
RUN pip install --no-cache-dir --user -r requirements.txt
ENV PATH=/home/user/.local/bin:$PATH

# Bake the XTTS weights into the image so the first message isn't a 2 GB
# download that blows past the request timeout.
RUN python -c "from TTS.api import TTS; TTS('tts_models/multilingual/multi-dataset/xtts_v2')"

COPY --chown=user package.json package-lock.json ./
RUN npm ci

COPY --chown=user tsconfig.server.json ./
COPY --chown=user server ./server
COPY --chown=user personality ./personality
COPY --chown=user voice ./voice
RUN npm run build:server && npm prune --omit=dev

RUN mkdir -p public/audio

COPY --chown=user start.sh ./
USER root
RUN chmod +x start.sh
USER user

# Spaces expose a single port; Express reads PORT, so point it at 7860.
ENV PORT=7860 \
    TTS_MODE=clone
EXPOSE 7860

CMD ["./start.sh"]
