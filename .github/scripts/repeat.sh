#!/usr/bin/env bash
set -Eeuo pipefail

repeat_count="$1"
shift

on_failure () {
    local exit_code=$?
    local compose_project="${COMPOSE_PROJECT_NAME:-}"
    local container_ids=()

    # 진단 자체가 실패해도 최초 테스트 실패 코드와 로그 수집을 덮지 않는다.
    trap - ERR
    set +e

    timeout --kill-after=5s 110s \
        bash "${WORKSPACE_ROOT}/.github/scripts/dump-mongo-diagnostics.sh" || \
        echo "MongoDB diagnostics timed out or failed"

    if [ -z "${compose_project}" ]; then
        echo "COMPOSE_PROJECT_NAME is unset; container diagnostics skipped"
        exit "${exit_code}"
    fi

    mapfile -t container_ids < <(
        timeout 10s docker ps -aq \
            --filter "label=com.docker.compose.project=${compose_project}"
    )
    timeout 10s docker ps -a \
        --filter "label=com.docker.compose.project=${compose_project}" || \
        echo "docker ps timed out or failed"
    if [ "${#container_ids[@]}" -gt 0 ]; then
        timeout 15s docker stats --no-stream "${container_ids[@]}" || \
            echo "docker stats timed out or failed"
    fi
    for id in "${container_ids[@]}"; do
        name=$(timeout 5s docker inspect --format '{{.Name}} ({{.State.Status}})' "${id}" || echo "${id} (inspect unavailable)")
        echo "========================= ${name} ========================="
        timeout 15s docker logs --tail 200 "${id}" || \
            echo "docker logs timed out or failed for ${id}"
    done

    exit "${exit_code}"
}
trap on_failure ERR

start_ts=$(date +%s)

# 단위 테스트·부팅·race 시나리오가 함께 쓰는 반복 도구라 기본적으로 `RESET_EVERY` 회차마다 인프라를 초기화한다.
# 사가 시나리오는 완료 기록과 앱 데이터가 누적되면 처리 지연이 커지므로, 회차당 워크플로 수가 많을수록 더 작은 값을 넘긴다.
RESET_EVERY="${RESET_EVERY:-10}"
RESET_SCRIPT="${WORKSPACE_ROOT:?WORKSPACE_ROOT must be set}/infra/reset.sh"

for ((i = 1; i <= repeat_count; i++)); do
    echo "[Run ${i}/${repeat_count} | $(($(date +%s) - start_ts))s]"
    if [ "${i}" -gt 1 ] && [ $(((i - 1) % RESET_EVERY)) -eq 0 ]; then
        echo "[reset infra @ iter ${i}]"
        bash "${RESET_SCRIPT}"
    fi
    "$@"
done
