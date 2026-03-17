@echo off
setlocal enabledelayedexpansion

:: ─────────────────────────────────────────────────
:: Hormuz Tracker — Build ^& Deploy to Synology NAS
:: ─────────────────────────────────────────────────
:: Usage: deploy-nas.bat
::
:: Builds Docker image, saves .tar, and generates
:: a docker-compose.yml with all env vars baked in.

set "SCRIPT_DIR=%~dp0"
set "OUTPUT_DIR=%USERPROFILE%\Documents"
set "IMAGE_NAME=hormuz-tracker"
set "TAR_PATH=%OUTPUT_DIR%\hormuz.tar"
set "COMPOSE_PATH=%OUTPUT_DIR%\hormuz-compose.yml"
set "ENV_FILE=%SCRIPT_DIR%.env.nas"

:: ── Check for saved env vars ──
if not exist "%ENV_FILE%" (
    echo.
    echo ┌─────────────────────────────────────────────┐
    echo │  First-time setup — saving NAS env vars      │
    echo │  These will be remembered for future builds   │
    echo └─────────────────────────────────────────────┘
    echo.

    set /p "AISSTREAM_API_KEY=AISSTREAM_API_KEY: "
    set /p "GITHUB_TOKEN=GITHUB_TOKEN (ghp_...): "
    set /p "GITHUB_REPO=GITHUB_REPO [JGM-89/hormuz]: "
    if "!GITHUB_REPO!"=="" set "GITHUB_REPO=JGM-89/hormuz"
    set /p "GITHUB_DATA_BRANCH=GITHUB_DATA_BRANCH [data]: "
    if "!GITHUB_DATA_BRANCH!"=="" set "GITHUB_DATA_BRANCH=data"
    set /p "OPENSKY_CLIENT_ID=OPENSKY_CLIENT_ID [kinswoman_nursery679-api-client]: "
    if "!OPENSKY_CLIENT_ID!"=="" set "OPENSKY_CLIENT_ID=kinswoman_nursery679-api-client"
    set /p "OPENSKY_CLIENT_SECRET=OPENSKY_CLIENT_SECRET [dB52RC9YbEOlGSLayaK8nnl3udRmVtAT]: "
    if "!OPENSKY_CLIENT_SECRET!"=="" set "OPENSKY_CLIENT_SECRET=dB52RC9YbEOlGSLayaK8nnl3udRmVtAT"

    (
        echo AISSTREAM_API_KEY=!AISSTREAM_API_KEY!
        echo GITHUB_TOKEN=!GITHUB_TOKEN!
        echo GITHUB_REPO=!GITHUB_REPO!
        echo GITHUB_DATA_BRANCH=!GITHUB_DATA_BRANCH!
        echo OPENSKY_CLIENT_ID=!OPENSKY_CLIENT_ID!
        echo OPENSKY_CLIENT_SECRET=!OPENSKY_CLIENT_SECRET!
    ) > "%ENV_FILE%"

    echo.
    echo Saved to %ENV_FILE%
    echo Edit this file to change values, or delete it to re-enter.
    echo.
)

:: ── Load env vars ──
for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    set "%%A=%%B"
)

echo.
echo ┌─────────────────────────────────────────────┐
echo │       HORMUZ TRACKER — NAS DEPLOY            │
echo └─────────────────────────────────────────────┘
echo.
echo   Image:   %IMAGE_NAME%
echo   Output:  %TAR_PATH%
echo   Compose: %COMPOSE_PATH%
echo.

:: ── Build Docker image ──
echo Building Docker image...
docker build -t "%IMAGE_NAME%:latest" "%SCRIPT_DIR%"
if errorlevel 1 (
    echo ERROR: Docker build failed
    pause
    exit /b 1
)
echo Image built successfully

:: ── Save .tar ──
echo Exporting .tar...
docker save "%IMAGE_NAME%:latest" -o "%TAR_PATH%"
if errorlevel 1 (
    echo ERROR: Docker save failed
    pause
    exit /b 1
)
echo Saved %TAR_PATH%

:: ── Generate docker-compose.yml ──
(
    echo version: "3.8"
    echo services:
    echo   hormuz:
    echo     image: hormuz-tracker:latest
    echo     container_name: hormuz-tracker
    echo     restart: unless-stopped
    echo     ports:
    echo       - "3001:3001"
    echo     volumes:
    echo       - hormuz-data:/app/data
    echo     environment:
    echo       - PORT=3001
    echo       - DB_PATH=/app/data/hormuz.db
    echo       - NODE_ENV=production
    echo       - AISSTREAM_API_KEY=!AISSTREAM_API_KEY!
    echo       - GITHUB_TOKEN=!GITHUB_TOKEN!
    echo       - GITHUB_REPO=!GITHUB_REPO!
    echo       - GITHUB_DATA_BRANCH=!GITHUB_DATA_BRANCH!
    echo       - OPENSKY_CLIENT_ID=!OPENSKY_CLIENT_ID!
    echo       - OPENSKY_CLIENT_SECRET=!OPENSKY_CLIENT_SECRET!
    echo.
    echo volumes:
    echo   hormuz-data:
    echo     driver: local
) > "%COMPOSE_PATH%"

echo Generated %COMPOSE_PATH%

echo.
echo ┌─────────────────────────────────────────────┐
echo │  DONE — Deploy to NAS:                       │
echo │                                               │
echo │  1. Open Synology Container Manager           │
echo │  2. Image - Import - select hormuz.tar        │
echo │  3. Project - Create - upload compose file     │
echo │     OR manually create container with the      │
echo │     env vars from the compose file             │
echo └─────────────────────────────────────────────┘
echo.
pause
