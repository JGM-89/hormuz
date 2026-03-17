#!/bin/bash
# ─────────────────────────────────────────────────
# Hormuz Tracker — Build & Deploy to Synology NAS
# ─────────────────────────────────────────────────
# Usage: ./deploy-nas.sh
#
# Builds Docker image, saves .tar, and generates
# a docker-compose.yml with all env vars baked in.
# Just import the .tar in Container Manager and
# use the compose file — no re-entering variables.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$HOME/Documents"
IMAGE_NAME="hormuz-tracker"
TAR_PATH="$OUTPUT_DIR/hormuz.tar"
COMPOSE_PATH="$OUTPUT_DIR/hormuz-compose.yml"
ENV_FILE="$SCRIPT_DIR/.env.nas"

# ── Check for saved env vars ──
if [ ! -f "$ENV_FILE" ]; then
  echo ""
  echo "┌─────────────────────────────────────────────┐"
  echo "│  First-time setup — saving NAS env vars      │"
  echo "│  These will be remembered for future builds   │"
  echo "└─────────────────────────────────────────────┘"
  echo ""

  read -p "AISSTREAM_API_KEY: " AISSTREAM_API_KEY
  read -p "GITHUB_TOKEN (ghp_...): " GITHUB_TOKEN
  read -p "GITHUB_REPO [JGM-89/hormuz]: " GITHUB_REPO
  GITHUB_REPO="${GITHUB_REPO:-JGM-89/hormuz}"
  read -p "GITHUB_DATA_BRANCH [data]: " GITHUB_DATA_BRANCH
  GITHUB_DATA_BRANCH="${GITHUB_DATA_BRANCH:-data}"
  read -p "OPENSKY_CLIENT_ID [kinswoman_nursery679-api-client]: " OPENSKY_CLIENT_ID
  OPENSKY_CLIENT_ID="${OPENSKY_CLIENT_ID:-kinswoman_nursery679-api-client}"
  read -p "OPENSKY_CLIENT_SECRET: " OPENSKY_CLIENT_SECRET
  OPENSKY_CLIENT_SECRET="${OPENSKY_CLIENT_SECRET:-dB52RC9YbEOlGSLayaK8nnl3udRmVtAT}"

  cat > "$ENV_FILE" << EOF
AISSTREAM_API_KEY=$AISSTREAM_API_KEY
GITHUB_TOKEN=$GITHUB_TOKEN
GITHUB_REPO=$GITHUB_REPO
GITHUB_DATA_BRANCH=$GITHUB_DATA_BRANCH
OPENSKY_CLIENT_ID=$OPENSKY_CLIENT_ID
OPENSKY_CLIENT_SECRET=$OPENSKY_CLIENT_SECRET
EOF

  echo ""
  echo "✓ Saved to $ENV_FILE (git-ignored)"
  echo "  Edit this file to change values, or delete it to re-enter."
  echo ""
fi

# ── Load env vars ──
source "$ENV_FILE"

echo ""
echo "┌─────────────────────────────────────────────┐"
echo "│       HORMUZ TRACKER — NAS DEPLOY            │"
echo "└─────────────────────────────────────────────┘"
echo ""
echo "  Image:   $IMAGE_NAME"
echo "  Output:  $TAR_PATH"
echo "  Compose: $COMPOSE_PATH"
echo ""

# ── Build Docker image ──
echo "▶ Building Docker image..."
docker build -t "$IMAGE_NAME:latest" "$SCRIPT_DIR"
echo "✓ Image built"

# ── Save .tar ──
echo "▶ Exporting .tar..."
docker save "$IMAGE_NAME:latest" -o "$TAR_PATH"
SIZE=$(ls -lh "$TAR_PATH" | awk '{print $5}')
echo "✓ Saved $TAR_PATH ($SIZE)"

# ── Generate docker-compose.yml ──
cat > "$COMPOSE_PATH" << EOF
version: "3.8"
services:
  hormuz:
    image: hormuz-tracker:latest
    container_name: hormuz-tracker
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - hormuz-data:/app/data
    environment:
      - PORT=3001
      - DB_PATH=/app/data/hormuz.db
      - NODE_ENV=production
      - AISSTREAM_API_KEY=$AISSTREAM_API_KEY
      - GITHUB_TOKEN=$GITHUB_TOKEN
      - GITHUB_REPO=$GITHUB_REPO
      - GITHUB_DATA_BRANCH=$GITHUB_DATA_BRANCH
      - OPENSKY_CLIENT_ID=$OPENSKY_CLIENT_ID
      - OPENSKY_CLIENT_SECRET=$OPENSKY_CLIENT_SECRET

volumes:
  hormuz-data:
    driver: local
EOF

echo "✓ Generated $COMPOSE_PATH"

echo ""
echo "┌─────────────────────────────────────────────┐"
echo "│  DONE — Deploy to NAS:                       │"
echo "│                                               │"
echo "│  1. Open Synology Container Manager           │"
echo "│  2. Image → Import → select hormuz.tar        │"
echo "│  3. Project → Create → upload compose file    │"
echo "│     OR manually create container with the      │"
echo "│     env vars from the compose file             │"
echo "└─────────────────────────────────────────────┘"
echo ""
