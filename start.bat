@echo off
REM ============================================================
REM  Arman's Digital Twin - one-click launcher (Windows)
REM  Starts: voice clone server + backend + frontend
REM ============================================================

cd /d "%~dp0"

echo.
echo  Starting Arman's Digital Twin...
echo  - Voice clone server (XTTS on GPU) loads in ~30s
echo  - Web app opens at http://localhost:5173
echo.

REM Start the voice clone server in its own window.
start "Voice Clone Server" cmd /k python voice\clone_server.py

REM Give the model a head start loading.
timeout /t 2 /nobreak >nul

REM Start the web app (frontend + backend) in this window.
call npm run dev
