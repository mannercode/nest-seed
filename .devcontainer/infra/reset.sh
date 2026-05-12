#!/bin/bash
set -Eeuo pipefail
cd "$(dirname "$0")"

docker compose down -v -t 0
docker compose up -d
docker wait "$(docker compose ps -aq infra-setup)" >/dev/null
docker compose ps -a --status=exited -q | xargs -r docker rm
