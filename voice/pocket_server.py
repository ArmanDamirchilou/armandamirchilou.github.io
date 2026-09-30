"""
Pocket TTS server - Arman's cloned voice on a plain CPU.

Kyutai's Pocket TTS (100M params, 2026) clones a voice from a few seconds of
audio and runs ~3x faster than real time on one of the Daytona sandbox's cores, so
unlike Chatterbox it doesn't need a GPU or the Mac worker: the twin keeps
speaking in Arman's voice around the clock.

The voice-cloning weights are gated on Hugging Face: accept the terms at
huggingface.co/kyutai/pocket-tts and put a read token in HF_TOKEN (or run
`hf auth login`). Without them the server still starts but reports
"no-clone", so the backend falls back to Kokoro instead of speaking in a
stranger's voice.

Setup:
    uv venv -p 3.12 ~/pocket-venv
    uv pip install -p ~/pocket-venv/bin/python pocket-tts soundfile \\
        --extra-index-url https://download.pytorch.org/whl/cpu --index-strategy unsafe-best-match

Usage:   ~/pocket-venv/bin/python voice/pocket_server.py
API:     POST /synthesize {"text": "..."}  -> audio/mpeg (audio/wav without ffmpeg)
         GET  /health                       -> {"status": "ready" | "no-clone", ...}
"""

import io
import json
import os
import shutil
import subprocess
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("POCKET_PORT", "5080"))
REF_WAV = os.environ.get("POCKET_REF_WAV", os.path.join(HERE, "arman_ref_chatterbox.wav"))
# Extracting the voice from the WAV takes a second; the result is cached here
# and reused until the reference recording changes.
STATE_CACHE = os.path.expanduser(os.environ.get("POCKET_STATE_CACHE", "~/.cache/arman-voice/pocket_voice.safetensors"))
TEMP = float(os.environ.get("POCKET_TEMP", "0.3"))


# Pocket TTS pins torch to one thread on import: the model is small enough
# that more threads only add overhead (~3x faster than real time on one core).
from pocket_tts import TTSModel  # noqa: E402

model = TTSModel.load_model(temp=TEMP)


def load_voice():
    """Arman's voice state, or None when the cloning weights aren't available."""
    try:
        if os.path.exists(STATE_CACHE) and os.path.getmtime(STATE_CACHE) > os.path.getmtime(REF_WAV):
            return model.get_state_for_audio_prompt(STATE_CACHE)
        state = model.get_state_for_audio_prompt(REF_WAV)
        try:
            from pocket_tts import export_model_state

            os.makedirs(os.path.dirname(STATE_CACHE), exist_ok=True)
            export_model_state(state, STATE_CACHE)
        except Exception as e:  # noqa: BLE001 - the cache is only an optimisation
            print(f"[Pocket] couldn't cache the voice state: {e}", flush=True)
        return state
    except ValueError as e:
        print(f"[Pocket] voice cloning unavailable: {str(e).splitlines()[0]}", flush=True)
        return None


voice = load_voice()

# One synthesis at a time: parallel runs split the same few cores and make
# every request slower. The HTTP server stays threaded so /health answers
# while a clip is being generated.
synth_lock = threading.Lock()
FFMPEG = shutil.which("ffmpeg")


def encode(samples: np.ndarray, rate: int) -> tuple[bytes, str]:
    """
    MP3 when ffmpeg is around: a visitor on a slow connection downloads a
    sentence 6x faster than as WAV, and it plays everywhere, Safari included.
    """
    pcm16 = (np.clip(samples, -1.0, 1.0) * 32767.0).astype(np.int16)
    if FFMPEG:
        try:
            out = subprocess.run(
                [FFMPEG, "-loglevel", "error", "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", "pipe:0",
                 "-c:a", "libmp3lame", "-b:a", "64k", "-f", "mp3", "pipe:1"],
                input=pcm16.tobytes(), capture_output=True, timeout=20, check=True,
            ).stdout
            if out:
                return out, "audio/mpeg"
        except (subprocess.SubprocessError, OSError) as e:
            print(f"[Pocket] mp3 encoding failed, sending WAV: {e}", flush=True)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(pcm16.tobytes())
    return buf.getvalue(), "audio/wav"


def synthesize(text: str) -> tuple[bytes, str]:
    with synth_lock:
        audio = model.generate_audio(voice, text)
    return encode(audio.numpy(), model.sample_rate)


class VoiceHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_json({"status": "ready" if voice is not None else "no-clone", "engine": "pocket-tts"})
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path != "/synthesize":
            self.send_error(404)
            return
        if voice is None:
            self.send_json({"error": "voice cloning weights unavailable"}, 503)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            text = json.loads(self.rfile.read(length)).get("text", "").strip()
            if not text:
                self.send_json({"error": "No text"}, 400)
                return
            t0 = time.time()
            audio, mime = synthesize(text[:1000])
            print(f'[Pocket] {time.time() - t0:.2f}s "{text[:50]}"', flush=True)
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)
        except Exception as e:  # noqa: BLE001 - report any failure to the caller
            print(f"[Pocket] Error: {e}", flush=True)
            self.send_json({"error": str(e)}, 500)

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    if voice is not None:
        t0 = time.time()
        synthesize("Warming up.")
        print(f"[Pocket] ready on :{PORT} ({time.time() - t0:.1f}s warm-up)", flush=True)
    else:
        print(f"[Pocket] listening on :{PORT} without a cloned voice; the backend will use its fallback", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), VoiceHandler).serve_forever()
