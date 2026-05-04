#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(pwd)"
cd .devcontainer/infra

# devcontainer.json 의 --env-file 캐시를 우회 — reset.sh 와 같은 이유.
set -a; source .env; set +a

docker rm -f $(docker ps -aq) 2>/dev/null || true
docker volume prune -af

# 외부 이미지 docker hub 직접 pull → 100/6h IP rate limit 가능. 첫 pull
# 시 선형 백오프 retry.
for attempt in 1 2 3 4 5; do
    docker compose up -d && break
    echo "[bootup-test] compose up failed (attempt $attempt)"
    [ "$attempt" = 5 ] && { echo "[bootup-test] gave up after 5 attempts"; exit 1; }
    docker compose down -v -t 0 || true
    sleep $((attempt * 10))
done
docker wait infra-setup
docker rm infra-setup

cd "$ROOT"
npm test -w apps
