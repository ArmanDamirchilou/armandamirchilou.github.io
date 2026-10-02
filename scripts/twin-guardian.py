"""
Keeps the twin's backend up. Run every few minutes by
.github/workflows/keep-twin-alive.yml (from GitHub's servers, which Daytona
doesn't geo-block), it:

  1. starts the Daytona sandbox if it has stopped,
  2. keeps the sandbox's auto-stop off and records activity, so it doesn't
     stop again for being idle (the Mac's voice worker used to do that by
     accident, and only while the Mac was awake),
  3. checks the twin answers, and if it doesn't, brings the pm2 processes
     back (`pm2 resurrect`, then `pm2 restart all`),
  4. exits non-zero if the twin is still down, so the run goes red and
     GitHub emails the repo owner.

Env: DAYTONA_API_KEY (secret), SANDBOX_ID, HEALTH_URL.
"""

import json
import os
import sys
import time
import urllib.request

from daytona import Daytona, DaytonaConfig

SANDBOX_ID = os.environ["SANDBOX_ID"]
HEALTH_URL = os.environ["HEALTH_URL"]
PM2 = "export PATH=$HOME/.local/bin:$PATH; cd ~/arman-personal-website && "


def healthy() -> bool:
    req = urllib.request.Request(HEALTH_URL, headers={"X-Daytona-Skip-Preview-Warning": "true", "User-Agent": "twin-guardian"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read())
        print(f"health: {data}")
        return data.get("status") == "online"
    except Exception as e:  # noqa: BLE001 - any failure means "not answering"
        print(f"health: no answer ({e})")
        return False


def wait_healthy(seconds: int) -> bool:
    deadline = time.time() + seconds
    while time.time() < deadline:
        if healthy():
            return True
        time.sleep(10)
    return False


def main() -> int:
    daytona = Daytona(DaytonaConfig(api_key=os.environ["DAYTONA_API_KEY"]))
    sandbox = daytona.get(SANDBOX_ID)
    print(f"sandbox state: {sandbox.state}")

    if str(sandbox.state).lower().split(".")[-1] != "started":
        print("starting the sandbox")
        sandbox.start(timeout=300)
        sandbox.process.exec(PM2 + "pm2 resurrect", timeout=120)

    # Never stop for being idle; nobody has to be using it to keep it up.
    sandbox.set_autostop_interval(0)
    sandbox.refresh_activity()

    if healthy():
        return 0

    print("twin not answering: resurrecting pm2")
    print(sandbox.process.exec(PM2 + "pm2 resurrect; pm2 ls", timeout=120).result)
    if wait_healthy(90):
        return 0

    print("still down: restarting every process")
    print(sandbox.process.exec(PM2 + "pm2 restart all; pm2 ls", timeout=180).result)
    if wait_healthy(150):
        return 0

    print("the twin is still down after a restart; logs follow")
    print(sandbox.process.exec(PM2 + "pm2 logs --lines 40 --nostream", timeout=60).result)
    return 1


if __name__ == "__main__":
    sys.exit(main())
