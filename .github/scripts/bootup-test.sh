#!/usr/bin/env bash
set -Eeuo pipefail

scope="$1"
cd .devcontainer/infra

docker rm -f $(docker ps -aq) 2>/dev/null || true
docker volume prune -af

# Base images가 모두 ghcr.io/mannercode/mirror/* 에서 pull 되므로 docker
# hub rate limit 발생할 경로 없음. retry 루프 불필요.
if [ "$scope" = "api" ]; then
    docker compose up -d
    docker wait infra-setup
    docker rm infra-setup
fi

cd /workspaces/nest-seed
npm test -w "apps/$scope" -- --coverageThreshold='{}'
