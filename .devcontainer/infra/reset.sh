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

# docker hub anonymous pull rate limit (100/6h per IP) + 공유 runner IP가 겹쳐
# 첫 pull이 자주 실패. 선형 백오프로 재시도.
for attempt in 1 2 3 4 5; do
    docker compose up -d && break
    echo "[reset.sh] compose up failed (attempt $attempt)"
    [ $attempt -eq 5 ] && { echo "[reset.sh] gave up after 5 attempts"; exit 1; }
    docker compose down -v -t 0 || true
    sleep $((attempt * 10))
done

docker wait infra-setup
docker rm infra-setup
