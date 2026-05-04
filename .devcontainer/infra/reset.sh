#!/bin/bash
set -Eeuo pipefail
cd "$(dirname "$0")"

# 실패시 리소스 압박(OOM/디스크) 단서 — 2026-04-28 bootup-api 회귀에서
# `exit code: undefined`로 죽었던 케이스 추적용.
on_err() {
    echo "[mem]"; head -5 /proc/meminfo 2>/dev/null || true
    echo "[disk]"; df -h / /tmp 2>/dev/null || true
}
trap on_err ERR

docker rm -f $(docker ps -aq) 2>/dev/null || true
docker volume prune -af

# 모든 base image 가 ghcr.io/mannercode/mirror/* 에서 pull 되므로 docker
# hub rate limit 이 발생할 경로가 없음. retry 루프 불필요.
docker compose up -d

docker wait infra-setup
docker rm infra-setup
