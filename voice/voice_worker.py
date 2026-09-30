"""
Voice worker - makes the twin speak in Arman's cloned voice from this machine.

The backend (on Daytona) can't reach this computer, and doesn't need to: the
worker long-polls the backend for sentences to say, synthesises each one with
Chatterbox in Arman's voice, and posts the WAV back. While it runs, the site
speaks in the cloned voice; when it stops (Mac off or asleep), the backend
falls back to its standard voice on its own.

Config comes from ~/.arman-voice/worker.env (or the environment):
    VOICE_BACKEND_URL   https://3001-<sandbox>.proxy.daytona.works
    VOICE_WORKER_TOKEN  shared secret, same value as the backend's .env

Usage:   ~/.arman-voice/venv/bin/python voice/voice_worker.py
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)


def load_env(path: str):
    if not os.path.exists(path):
        return
    for line in open(path):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


load_env(os.path.expanduser("~/.arman-voice/worker.env"))
BACKEND = os.environ.get("VOICE_BACKEND_URL", "").rstrip("/")
TOKEN = os.environ.get("VOICE_WORKER_TOKEN", "")
if not BACKEND or len(TOKEN) < 24:
    print("[Worker] set VOICE_BACKEND_URL and VOICE_WORKER_TOKEN in ~/.arman-voice/worker.env", flush=True)
    sys.exit(1)

import chatterbox_server as voice  # noqa: E402  (after env: it reads CHATTERBOX_* on import)

HEADERS = {"Authorization": f"Bearer {TOKEN}", "User-Agent": "arman-voice-worker/1"}


def request(method: str, path: str, body: bytes | None = None, content_type: str | None = None, timeout: float = 30):
    headers = dict(HEADERS)
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(f"{BACKEND}{path}", data=body, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read()


def compress(wav: bytes) -> tuple[bytes, str]:
    """
    WAV -> 40 kbps AAC (about 8x smaller) with macOS's built-in afconvert.
    Upload is the slow leg from a home connection: a 200 KB WAV took 11s where
    the AAC takes ~1.5s. Anywhere without afconvert, send the WAV as is.
    """
    if not wav or not shutil.which("afconvert"):
        return wav, "audio/wav"
    with tempfile.TemporaryDirectory() as d:
        src, dst = os.path.join(d, "in.wav"), os.path.join(d, "out.m4a")
        open(src, "wb").write(wav)
        r = subprocess.run(
            ["afconvert", "-f", "m4af", "-d", "aac", "-b", "40000", src, dst],
            capture_output=True,
        )
        if r.returncode != 0 or not os.path.exists(dst):
            return wav, "audio/wav"
        return open(dst, "rb").read(), "audio/mp4"


def upload(job: dict, audio: bytes, mime: str, took: float):
    try:
        request("POST", f"/api/voice/result/{job['id']}", audio, mime, timeout=30)
        note = ""
    except urllib.error.HTTPError as e:
        note = " (too late, the backend already used its fallback voice)" if e.code == 410 else f" (upload HTTP {e.code})"
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
        note = f" (upload failed: {e})"
    print(f'[Worker] {took:.1f}s "{job["text"][:50]}"{note}', flush=True)


def main():
    voice.load_model()
    print(f"[Worker] connected to {BACKEND}, waiting for sentences", flush=True)
    # Uploads run beside synthesis: on a slow home uplink, sending one clip
    # takes about as long as making the next, so doing both at once halves
    # the wait for every sentence after the first.
    uploads = ThreadPoolExecutor(max_workers=2)
    backoff = 1.0
    while True:
        try:
            # The backend holds this open for up to 20s waiting for work and
            # hands over every queued sentence at once.
            status, body = request("GET", "/api/voice/next", timeout=35)
            backoff = 1.0
            if status == 204 or not body:
                continue
            for job in json.loads(body)["jobs"]:
                t0 = time.time()
                try:
                    wav = voice.synth_wav_bytes(job["text"][:600])
                except Exception as e:  # noqa: BLE001 - never let one sentence kill the worker
                    print(f"[Worker] synthesis failed: {e}", flush=True)
                    wav = b""
                audio, mime = compress(wav)
                uploads.submit(upload, job, audio, mime, time.time() - t0)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print("[Worker] backend rejected the token (or has no VOICE_WORKER_TOKEN set)", flush=True)
                time.sleep(30)
            else:
                print(f"[Worker] HTTP {e.code}, retrying", flush=True)
                time.sleep(backoff)
                backoff = min(backoff * 2, 30)
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            print(f"[Worker] connection problem ({e}), retrying in {backoff:.0f}s", flush=True)
            time.sleep(backoff)
            backoff = min(backoff * 2, 30)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[Worker] stopped", flush=True)
