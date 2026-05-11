#!/bin/bash
set -Eeuo pipefail
cd "$(dirname "$0")"

# 실패시 리소스 압박(OOM/디스크) 단서 — 2026-04-28 bootup-api 회귀에서
# `exit code: undefined`로 죽었던 케이스 추적용.
on_err() {
    echo "[mem]"; head -5 /proc/meminfo 2>/dev/null || true
    echo "[disk]"; df -h / /tmp 2>/dev/null || true
    echo "[docker compose ps]"; docker compose ps -a 2>/dev/null || true
    for cid in $(docker compose ps -aq 2>/dev/null); do
        cname=$(docker inspect --format '{{.Name}} ({{.State.Status}}, exit={{.State.ExitCode}})' "$cid" 2>/dev/null || echo "$cid")
        echo "--- logs $cname (last 80) ---"
        docker logs --tail 80 "$cid" 2>&1 || true
    done
}
trap on_err ERR

# devcontainer.json 의 --env-file 로 시작 시점 .env 가 process env 에 cached.
# .env 변경은 devcontainer rebuild 전엔 안 보이므로 매 reset 마다 명시적 source
# 해서 shell env 갱신. docker compose 의 우선순위는 process env > .env file
# 라 이게 안 되면 옛 값으로 잘못 인터폴레이션됨.
set -a
source .env
set +a

# dod (docker-outside-of-docker) 환경 — `docker rm -f $(docker ps -aq)` 같은
# daemon-wide 명령은 호스트의 다른 컨테이너 (devcontainer 자기 자신 포함) 를
# 다 죽이므로 절대 쓰지 말 것. compose project (COMPOSE_PROJECT_NAME) 단위로만.
docker compose down -v -t 0

# 외부 네트워크는 멱등 생성. devcontainer 와 deploy compose 도 같은 이름으로 join.
docker network create nest-seed-infra 2>/dev/null || true

docker compose up -d

# infra-setup 은 모든 setup 이 service_completed_successfully 됐음을 알리는
# sentinel — 자기 자신도 즉시 종료한다. `docker compose wait` 는 running
# 컨테이너만 처리해 이미 종료된 sentinel 에서는 "no containers" 로 실패하므로
# container-level `docker wait` 로 종료 코드를 직접 받는다.
sentinel=$(docker compose ps -aq infra-setup)
[ -n "$sentinel" ] || { echo "infra-setup container not created" >&2; exit 1; }
exit_code=$(docker wait "$sentinel")
[ "$exit_code" = "0" ] || { echo "infra-setup failed (exit=$exit_code)" >&2; exit "$exit_code"; }

# setup 컨테이너들은 종료된 상태로 남아 있음 — 다음 up 에서 conflict 안 나도록 정리.
docker compose ps -a --status=exited -q | xargs -r docker rm
