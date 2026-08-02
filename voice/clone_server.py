"""
Voice Cloning Server - Coqui XTTS v2 on GPU

Clones Arman's voice from a reference sample. Speaker conditioning latents are
computed ONCE at startup and reused on every request, so each reply only runs
the fast inference path (a few seconds on GPU) instead of re-embedding the
44-second reference every time.

Usage:   python voice/clone_server.py
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

os.environ["COQUI_TOS_AGREED"] = "1"

import numpy as np
import torch

_original_load = torch.load
def _patched_load(*args, **kwargs):
    kwargs["weights_only"] = False
    return _original_load(*args, **kwargs)
torch.load = _patched_load

VOICE_SAMPLE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "arman_voice_sample.wav")
PORT = 5050

xtts = None
gpt_cond_latent = None
speaker_embedding = None
output_sr = 24000


def load_model():
    global xtts, gpt_cond_latent, speaker_embedding, output_sr
    print("[Voice] Loading XTTS v2 model...")

    from TTS.api import TTS
    api = TTS("tts_models/multilingual/multi-dataset/xtts_v2")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    api.to(device)
    if device == "cuda":
        print(f"[Voice] Using GPU: {torch.cuda.get_device_name(0)}")
    else:
        print("[Voice] Using CPU (slower)")

    xtts = api.synthesizer.tts_model
    try:
        output_sr = api.synthesizer.output_sample_rate
    except Exception:
        output_sr = 24000

    print("[Voice] Computing speaker latents (one time)...")
    t0 = time.time()
    gpt_cond_latent, speaker_embedding = xtts.get_conditioning_latents(audio_path=[VOICE_SAMPLE])
    print(f"[Voice] Latents ready in {time.time() - t0:.1f}s")

    print("[Voice] Warming up CUDA kernels (one time)...")
    t0 = time.time()
    _ = xtts.inference("Warming up the voice engine.", "en", gpt_cond_latent, speaker_embedding, temperature=0.7)
    print(f"[Voice] Warm up done in {time.time() - t0:.1f}s. Ready for fast responses.")


def synth_wav_bytes(text: str) -> bytes:
    out = xtts.inference(
        text,
        "en",
        gpt_cond_latent,
        speaker_embedding,
        temperature=0.7,
        enable_text_splitting=True,
    )
    wav = out["wav"]
    if isinstance(wav, torch.Tensor):
        wav = wav.detach().cpu().numpy()
    wav = np.asarray(wav, dtype=np.float32)
    wav = np.clip(wav, -1.0, 1.0)
    pcm16 = (wav * 32767.0).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(output_sr)
        wf.writeframes(pcm16.tobytes())
    return buf.getvalue()


class VoiceHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_json({"status": "ready" if xtts is not None else "not_loaded"})
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
            if not text or xtts is None:
                self.send_json({"error": "No text or model not loaded"}, 400)
                return

            print(f'[Voice] Synthesizing: "{text[:60]}"')
            t0 = time.time()
            audio = synth_wav_bytes(text)
            print(f"[Voice] Done in {time.time() - t0:.1f}s ({len(audio)} bytes)")

            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(audio)
        except Exception as e:
            print(f"[Voice] Error: {e}")
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
    if not os.path.exists(VOICE_SAMPLE):
        print(f"[Voice] ERROR: Voice sample not found at {VOICE_SAMPLE}")
        sys.exit(1)

    load_model()
    server = HTTPServer(("127.0.0.1", PORT), VoiceHandler)
    print(f"\n[Voice] Server ready at http://127.0.0.1:{PORT}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Voice] Shutting down")
        server.server_close()
