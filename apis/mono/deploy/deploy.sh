#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f .env ]; then
    echo "Error: .env file not found. Copy .env.example to .env and configure it."
    echo "  cp .env.example .env"
    exit 1
fi

echo "Building and deploying mono app..."
docker compose up --build -d

echo ""
echo "Waiting for health checks..."
docker compose up --wait

echo ""
docker compose ps
echo ""
echo "Deploy complete. Listening on port ${LISTEN_PORT:-3000}"
