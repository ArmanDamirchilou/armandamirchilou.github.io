@echo off
echo ── Finding Blender 4.x ──────────────────────────────────────────
set BLENDER=

:: Check common install locations
for /d %%G in ("C:\Program Files\Blender Foundation\Blender 4.*") do set BLENDER=%%G\blender.exe
for /d %%G in ("C:\Program Files\Blender Foundation\Blender 3.*") do if not defined BLENDER set BLENDER=%%G\blender.exe

:: Also check PATH
if not defined BLENDER (
    where blender >nul 2>&1 && set BLENDER=blender
)

if not defined BLENDER (
    echo [ERROR] Blender not found. Please install Blender 4.x or set BLENDER variable manually.
    pause
    exit /b 1
)

echo [OK] Using Blender: %BLENDER%
echo.
echo ── Running bake_animations.py ───────────────────────────────────
"%BLENDER%" --background --python "%~dp0bake_animations.py"

echo.
if %ERRORLEVEL% == 0 (
    echo [SUCCESS] Animation bake complete! Check public\model.glb
) else (
    echo [ERROR] Bake failed. Check the output above for details.
)
pause
