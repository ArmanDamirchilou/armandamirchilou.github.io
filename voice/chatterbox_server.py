"""
Voice-clone server - Chatterbox (Resemble AI, MIT licence) speaking in Arman's voice.

Runs wherever there's a GPU: Apple Silicon (MPS), NVIDIA (CUDA), or CPU as a
last resort (too slow for live conversation). The speaker conditioning is
computed once at startup from a short reference clip and reused, so each
request only runs inference.

Two models:
  CHATTERBOX_MODEL=turbo  (default) 350M, one-step decoder, fastest
  CHATTERBOX_MODEL=full   0.5B, a little more faithful, slower

Setup (macOS, from the repo root):
    uv venv -p 3.11 ~/.arman-voice/venv
    uv pip install -p ~/.arman-voice/venv/bin/python chatterbox-tts "setuptools<81"

Usage:   ~/.arman-voice/venv/bin/python voice/chatterbox_server.py
API:     POST /synthesize {"text": "..."}  -> audio/wav
         GET  /health                       -> {"status": "ready", ...}
"""

import io
import json
import os
import sys
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# MPS lacks a few ops Chatterbox uses; let them fall back to CPU instead of
# crashing. Must be set before torch is imported.
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

import numpy as np
import torch

_HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("CHATTERBOX_PORT", "5060"))
MODEL = os.environ.get("CHATTERBOX_MODEL", "turbo")

# Reference voice: a clean 10-30s clip of Arman talking naturally.
REF_CANDIDATES = [
    os.environ.get("CHATTERBOX_REF", ""),
    os.path.join(_HERE, "arman_ref_chatterbox.wav"),
    os.path.join(_HERE, "arman_voice_sample.wav"),
]
VOICE_SAMPLE = next((p for p in REF_CANDIDATES if p and os.path.exists(p)), None)

# Chatterbox pins older torch whose checkpoints need full unpickling.
_original_load = torch.load


def _patched_load(*args, **kwargs):
    kwargs.setdefault("weights_only", False)
    kwargs.setdefault("map_location", "cpu")
    return _original_load(*args, **kwargs)


torch.load = _patched_load

model = None
device = "cpu"
# One synthesis at a time: the GPU is the bottleneck, and interleaving two
# requests only makes both slower. The server stays threaded so /health
# answers while a clip is being made.
synth_lock = threading.Lock()


def pick_device() -> str:
    # Measured on an M5 Pro: Turbo runs ~1.8x faster on the CPU than on MPS,
    # whose per-token overhead dominates this small autoregressive model. So
    # Apple GPUs are opt-in (CHATTERBOX_DEVICE=mps); CUDA is used when present.
    forced = os.environ.get("CHATTERBOX_DEVICE")
    if forced:
        return forced
    if torch.cuda.is_available():
        return "cuda"
    torch.set_num_threads(int(os.environ.get("CHATTERBOX_THREADS", min(10, os.cpu_count() or 4))))
    return "cpu"


def load_model():
    global model, device
    device = pick_device()
    t0 = time.time()
    if MODEL == "full":
        from chatterbox.tts import ChatterboxTTS as Engine
    else:
        from chatterbox.tts_turbo import ChatterboxTurboTTS as Engine
    model = Engine.from_pretrained(device=device)
    print(f"[Chatterbox] {MODEL} model on {device} in {time.time() - t0:.1f}s", flush=True)

    t0 = time.time()
    model.prepare_conditionals(VOICE_SAMPLE, exaggeration=0.5)
    print(f"[Chatterbox] voice from {os.path.basename(VOICE_SAMPLE)} in {time.time() - t0:.1f}s", flush=True)

    t0 = time.time()
    synth_wav_bytes("Warming up the voice.")
    print(f"[Chatterbox] warm-up {time.time() - t0:.1f}s", flush=True)


def synth_wav_bytes(text: str) -> bytes:
    with synth_lock, torch.inference_mode():
        if MODEL == "full":
            wav = model.generate(text, exaggeration=0.5, cfg_weight=0.5, temperature=0.7)
        else:
            wav = model.generate(text, temperature=0.7)
    wav = np.asarray(wav.detach().cpu().numpy() if isinstance(wav, torch.Tensor) else wav, dtype=np.float32).squeeze()
    pcm16 = (np.clip(wav, -1.0, 1.0) * 32767.0).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(int(getattr(model, "sr", 24000)))
        wf.writeframes(pcm16.tobytes())
    return buf.getvalue()


class VoiceHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_json(
                {
                    "status": "ready" if model is not None else "not_loaded",
                    "engine": f"chatterbox-{MODEL}",
                    "device": device,
                }
            )
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path != "/synthesize":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            text = json.loads(self.rfile.read(length)).get("text", "").strip()
            if not text or model is None:
                self.send_json({"error": "No text or model not loaded"}, 400)
                return
            t0 = time.time()
            audio = synth_wav_bytes(text[:600])
            secs = (len(audio) - 44) / 2 / getattr(model, "sr", 24000)
            print(f'[Chatterbox] {time.time() - t0:.1f}s for {secs:.1f}s audio: "{text[:50]}"', flush=True)
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)
        except Exception as e:  # noqa: BLE001 - report any failure to the caller
            print(f"[Chatterbox] Error: {e}", flush=True)
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
    if not VOICE_SAMPLE:
        print("[Chatterbox] ERROR: no reference voice sample found", flush=True)
        sys.exit(1)
    load_model()
    print(f"[Chatterbox] ready at http://127.0.0.1:{PORT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), VoiceHandler).serve_forever()
