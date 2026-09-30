"""
Kokoro TTS server - fast, natural English speech on a plain CPU.

The cloned-voice engines (XTTS, Chatterbox) need a GPU to keep up with a live
conversation; on a small CPU box they run several times slower than real time.
Kokoro-82M (int8 ONNX) speaks faster than real time on 2-4 cores, so this is
the voice for CPU-only hosts.

Setup (separate venv - kokoro-onnx needs numpy 2, Chatterbox needs numpy 1):
    uv venv -p 3.11 ~/kokoro-venv
    uv pip install -p ~/kokoro-venv/bin/python kokoro-onnx soundfile
    # model files: github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0)
    #   kokoro-v1.0.int8.onnx + voices-v1.0.bin  ->  $KOKORO_DIR

Usage:   ~/kokoro-venv/bin/python voice/kokoro_server.py
API:     POST /synthesize {"text": "..."}  -> audio/wav
         GET  /health                       -> {"status": "ready", "voice": "..."}
"""

import io
import json
import os
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import onnxruntime as ort
from kokoro_onnx import Kokoro

MODEL_DIR = os.environ.get("KOKORO_DIR", os.path.expanduser("~/kokoro"))
VOICE = os.environ.get("KOKORO_VOICE", "am_puck")
SPEED = float(os.environ.get("KOKORO_SPEED", "1.05"))
PORT = int(os.environ.get("KOKORO_PORT", "5070"))


def cpu_quota() -> int:
    """
    Cores we may actually use. Containers often report every host core while a
    cgroup caps us at a few; one thread per reported core then gets throttled
    so hard that synthesis runs 4x slower than with the right count.
    """
    try:
        quota, period = open("/sys/fs/cgroup/cpu.max").read().split()
        if quota != "max":
            return max(1, int(int(quota) / int(period)))
    except (OSError, ValueError):
        pass
    return os.cpu_count() or 1


opts = ort.SessionOptions()
opts.intra_op_num_threads = cpu_quota()
opts.inter_op_num_threads = 1
session = ort.InferenceSession(
    os.path.join(MODEL_DIR, "kokoro-v1.0.int8.onnx"), opts, providers=["CPUExecutionProvider"]
)
kokoro = Kokoro.from_session(session, os.path.join(MODEL_DIR, "voices-v1.0.bin"))

# One synthesis at a time: parallel runs just split the same few cores and
# make every request slower. The HTTP server stays threaded so /health answers
# while a clip is being generated.
synth_lock = threading.Lock()


def synth_wav_bytes(text: str) -> bytes:
    with synth_lock:
        samples, sr = kokoro.create(text, voice=VOICE, speed=SPEED, lang="en-us")
    pcm16 = (np.clip(samples, -1.0, 1.0) * 32767.0).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(int(sr))
        wf.writeframes(pcm16.tobytes())
    return buf.getvalue()


class VoiceHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_json({"status": "ready", "engine": "kokoro", "voice": VOICE})
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path != "/synthesize":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            text = json.loads(self.rfile.read(length)).get("text", "").strip()
            if not text:
                self.send_json({"error": "No text"}, 400)
                return
            t0 = time.time()
            audio = synth_wav_bytes(text[:1000])
            print(f'[Kokoro] {time.time() - t0:.2f}s "{text[:50]}"', flush=True)
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)
        except Exception as e:  # noqa: BLE001 - report any failure to the caller
            print(f"[Kokoro] Error: {e}", flush=True)
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
    t0 = time.time()
    synth_wav_bytes("Warming up.")
    print(f"[Kokoro] ready on :{PORT} with {opts.intra_op_num_threads} threads, voice {VOICE} ({time.time() - t0:.1f}s warm-up)", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), VoiceHandler).serve_forever()
