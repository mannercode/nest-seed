#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f .env ]; then
    echo "Error: .env file not found. Copy .env.example to .env and configure it."
    echo "  cp .env.example .env"
    exit 1
fi

cleanup() {
    echo ""
    echo "Tearing down..."
    docker compose down -v -t 0
}
trap cleanup EXIT

echo "Building and deploying mono app..."
docker compose up --build -d
docker compose up --wait

echo ""
docker compose ps

LISTEN_PORT=${LISTEN_PORT:-3000}

echo ""
echo "Running stress test against localhost:${LISTEN_PORT}..."
SERVER_URL="http://localhost:${LISTEN_PORT}" \
    CLIENTS="${CLIENTS:-10}" \
    ROUNDS="${ROUNDS:-3}" \
    bash e2e/stress.sh
