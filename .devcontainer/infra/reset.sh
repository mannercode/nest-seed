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

# devcontainer.json 의 --env-file 로 시작 시점 .env 가 process env 에 cached.
# .env 변경은 devcontainer rebuild 전엔 안 보이므로 매 reset 마다 명시적 source
# 해서 shell env 갱신. docker compose 의 우선순위는 process env > .env file
# 라 이게 안 되면 옛 값으로 잘못 인터폴레이션됨.
set -a
source .env
set +a

docker rm -f $(docker ps -aq) 2>/dev/null || true
docker volume prune -af

# 외부 이미지를 docker hub 에서 직접 pull 하므로 100/6h IP rate limit 가능성
# 다시 등장. 첫 pull flake 흡수용 선형 백오프.
for attempt in 1 2 3 4 5; do
    docker compose up -d && break
    echo "[reset.sh] compose up failed (attempt $attempt)"
    [ $attempt -eq 5 ] && { echo "[reset.sh] gave up after 5 attempts"; exit 1; }
    docker compose down -v -t 0 || true
    sleep $((attempt * 10))
done

docker wait infra-setup
docker rm infra-setup
