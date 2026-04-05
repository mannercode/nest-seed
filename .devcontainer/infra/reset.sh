#!/bin/bash
set -Eeuo pipefail
cd "$(dirname "$0")"

docker rm -f $(docker ps -aq) 2>/dev/null || true
docker volume prune -af

docker compose up -d
cd msa
docker compose up -d

docker wait infra-setup msa-setup
docker rm infra-setup msa-setup
