"""
Voice Cloning Server - Chatterbox TTS (Resemble AI, 2026) on GPU

Newer/better replacement for XTTS v2. Clones Arman's voice from a short
reference clip. The speaker conditioning is prepared ONCE at startup and reused
on every request, so each reply only runs the fast inference path.

Runs in an isolated venv (voice/chatterbox-venv) that reuses the system CUDA
torch, so it never disturbs the working XTTS environment.

Usage:   voice/chatterbox-venv/Scripts/python.exe voice/chatterbox_server.py
API:     POST /synthesize {"text": "..."}  -> audio/wav
         GET  /health                       -> {"status": "ready"}
"""

import os
import sys
import io
import json
import wave
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

# Keep HuggingFace model cache on the E: drive (more free space than C:).
_HERE = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("HF_HOME", os.path.join(_HERE, ".hf-cache"))
# The model is already downloaded — load it from the local cache and never touch
# the network. Prevents getaddrinfo/DNS crashes when HuggingFace is unreachable.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

import numpy as np
import torch

# Chatterbox ships with torch>=2.6 pins; we run 2.7.1. torch.load defaults
# changed across versions — force full unpickling for the checkpoint load.
_original_load = torch.load
def _patched_load(*args, **kwargs):
    kwargs.setdefault("weights_only", False)
    return _original_load(*args, **kwargs)
torch.load = _patched_load

# Reference voice: a clean ~13s clip works best for Chatterbox.
REF_CANDIDATES = [
    os.path.join(_HERE, "arman_ref_chatterbox.wav"),
    os.path.join(_HERE, "arman_voice_sample.wav"),
]
VOICE_SAMPLE = next((p for p in REF_CANDIDATES if os.path.exists(p)), None)
PORT = 5060

model = None
output_sr = 24000


def load_model():
    global model, output_sr
    print("[Chatterbox] Loading model (first run downloads ~2GB weights)...")
    from chatterbox.tts import ChatterboxTTS

    device = "cuda" if torch.cuda.is_available() else "cpu"
    t0 = time.time()
    model = ChatterboxTTS.from_pretrained(device=device)
    output_sr = getattr(model, "sr", 24000)
    print(f"[Chatterbox] Model ready on {device} in {time.time() - t0:.1f}s (sr={output_sr})")

    if device == "cuda":
        print(f"[Chatterbox] GPU: {torch.cuda.get_device_name(0)}")

    print(f"[Chatterbox] Preparing voice from {os.path.basename(VOICE_SAMPLE)} (one time)...")
    t0 = time.time()
    model.prepare_conditionals(VOICE_SAMPLE, exaggeration=0.5)
    print(f"[Chatterbox] Voice ready in {time.time() - t0:.1f}s")

    print("[Chatterbox] Warming up (one time)...")
    t0 = time.time()
    _ = model.generate("Warming up the voice engine.", cfg_weight=0.5, temperature=0.7)
    print(f"[Chatterbox] Warm up done in {time.time() - t0:.1f}s. Ready.")


def synth_wav_bytes(text: str) -> bytes:
    # Conditionals were cached in load_model(); no audio_prompt_path needed.
    wav = model.generate(text, cfg_weight=0.5, temperature=0.7, exaggeration=0.5)
    if isinstance(wav, torch.Tensor):
        wav = wav.detach().cpu().numpy()
    wav = np.asarray(wav, dtype=np.float32).squeeze()
    wav = np.clip(wav, -1.0, 1.0)
    pcm16 = (wav * 32767.0).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(int(output_sr))
        wf.writeframes(pcm16.tobytes())
    return buf.getvalue()


class VoiceHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_json({"status": "ready" if model is not None else "not_loaded"})
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path != "/synthesize":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            text = json.loads(body).get("text", "").strip()
            if not text or model is None:
                self.send_json({"error": "No text or model not loaded"}, 400)
                return
            print(f'[Chatterbox] Synthesizing: "{text[:60]}"')
            t0 = time.time()
            audio = synth_wav_bytes(text)
            print(f"[Chatterbox] Done in {time.time() - t0:.1f}s ({len(audio)} bytes)")
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(audio)
        except Exception as e:
            print(f"[Chatterbox] Error: {e}")
            self.send_json({"error": str(e)}, 500)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    if not VOICE_SAMPLE:
        print("[Chatterbox] ERROR: no reference voice sample found")
        sys.exit(1)
    load_model()
    server = HTTPServer(("127.0.0.1", PORT), VoiceHandler)
    print(f"\n[Chatterbox] Server ready at http://127.0.0.1:{PORT}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Chatterbox] Shutting down")
        server.server_close()
