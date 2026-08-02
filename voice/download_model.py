"""
Download the Chatterbox voice model with a visible progress bar.

Resumable: safe to stop (Ctrl+C) and re-run — it continues where it left off.
Run:  npm run voice:download
(or:  voice/chatterbox-venv/Scripts/python.exe voice/download_model.py)

If it crawls at ~1 KB/s and never moves, HuggingFace is throttled from your
network — turn on a VPN (Europe/US) and re-run; it'll then fly.
"""

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("HF_HOME", os.path.join(_HERE, ".hf-cache"))
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
# Make the transfer progress bars show even in plain terminals.
os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "0")

try:
    from huggingface_hub import snapshot_download
except Exception as e:  # pragma: no cover
    print("Could not import huggingface_hub from the Chatterbox venv:", e)
    sys.exit(1)

REPO = "ResembleAI/chatterbox"

print(f"Downloading {REPO}  (~2.1 GB, resumable - safe to stop and re-run)\n")

try:
    path = snapshot_download(repo_id=REPO)
    print("\n\nDone. Model is ready at:\n ", path)
    print("\nStart the voice with:  npm run voice:chatterbox")
except KeyboardInterrupt:
    print("\n\nStopped. Progress is saved — re-run `npm run voice:download` to continue.")
    sys.exit(0)
except Exception as e:
    print("\n\nDownload error:", e)
    print("If this keeps failing at a crawl, HuggingFace is throttled from your")
    print("network — connect a VPN (Europe/US) and run `npm run voice:download` again.")
    sys.exit(1)
