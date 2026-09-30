#!/bin/sh
# Runs the cloned-voice worker (voice/voice_worker.py) on this Mac as a login
# item: it starts at login, restarts if it crashes, and keeps the Mac from
# idle-sleeping while it runs (the display can still sleep). When the Mac is
# off, the site simply falls back to its standard voice.
#
#   voice/mac-voice.sh install     start now and at every login
#   voice/mac-voice.sh uninstall   stop and remove
#   voice/mac-voice.sh status      is it running, and what voice is the site using
#   voice/mac-voice.sh logs        follow the worker log
set -eu

LABEL=com.armandamirchilou.voiceworker
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PY="$HOME/.arman-voice/venv/bin/python"
LOG="$HOME/.arman-voice/worker.log"

case "${1:-status}" in
  install)
    [ -x "$PY" ] || { echo "missing $PY (see voice/chatterbox_server.py for setup)"; exit 1; }
    [ -f "$HOME/.arman-voice/worker.env" ] || { echo "missing ~/.arman-voice/worker.env"; exit 1; }
    mkdir -p "$HOME/Library/LaunchAgents"
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string><string>-i</string>
    <string>$PY</string><string>-u</string><string>$REPO/voice/voice_worker.py</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <!-- Without this, launchd agents get background QoS and macOS keeps them on
       the efficiency cores: synthesis ran 2-6x slower than in a terminal. -->
  <key>ProcessType</key><string>Interactive</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>15</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF
    # bootout returns before the old job is gone; bootstrapping straight away
    # fails with "Input/output error".
    if launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null; then sleep 3; fi
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
    echo "installed; it takes ~20s to load the model. Check with: $0 status"
    ;;
  uninstall)
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "removed; the site will use its standard voice"
    ;;
  status)
    if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then echo "worker: installed"; else echo "worker: not installed"; fi
    grep '\[Worker\]' "$LOG" 2>/dev/null | tail -3 || true
    url=$(sed -n 's/^VOICE_BACKEND_URL=//p' "$HOME/.arman-voice/worker.env" 2>/dev/null)
    [ -n "$url" ] && curl -s -m 10 "$url/api/health" && echo
    ;;
  logs)
    tail -f "$LOG"
    ;;
  *)
    echo "usage: $0 install|uninstall|status|logs"; exit 1
    ;;
esac
