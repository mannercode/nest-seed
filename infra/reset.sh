#!/bin/bash
set -Eeuo pipefail
cd "$(dirname "$0")"

diagnose_and_exit() {
    local exit_code="$1"

    trap - ERR
    set +e
    timeout 10s docker compose ps -a >&2
    timeout 30s docker compose logs --no-color --tail 100 >&2
    exit "${exit_code}"
}

trap 'diagnose_and_exit "$?"' ERR

cleanup_legacy_temporal() {
    local service
    local -a container_ids=()
    local -a matched=()
    local -a volume_ids=()

    # Compose 파일에서 제거된 서비스는 down --remove-orphans 없이는 남는다. deploy와
    # project를 공유하므로 전체 orphan 대신 이 project의 옛 Temporal 자원만 고른다.
    for service in temporal temporal-postgresql temporal-setup temporal-create-namespace; do
        mapfile -t matched < <(
            docker ps -aq \
                --filter "label=com.docker.compose.project=${COMPOSE_PROJECT_NAME}" \
                --filter "label=com.docker.compose.service=${service}"
        )
        container_ids+=("${matched[@]}")
    done
    if [ "${#container_ids[@]}" -gt 0 ]; then
        docker rm -f "${container_ids[@]}"
    fi

    mapfile -t volume_ids < <(
        docker volume ls -q \
            --filter "label=com.docker.compose.project=${COMPOSE_PROJECT_NAME}" \
            --filter 'label=com.docker.compose.volume=temporal_pgdata'
    )
    if [ "${#volume_ids[@]}" -gt 0 ]; then
        docker volume rm "${volume_ids[@]}"
    fi
}

cleanup_legacy_temporal
docker compose down -v -t 0
docker compose up -d

setup_id="$(docker compose ps -aq infra-setup)"
if [ -z "${setup_id}" ]; then
    echo "infra-setup container was not created" >&2
    diagnose_and_exit 1
fi

setup_exit="$(docker wait "${setup_id}")"
if [ "${setup_exit}" -ne 0 ]; then
    echo "infra-setup failed with exit code ${setup_exit}" >&2
    diagnose_and_exit "${setup_exit}"
fi

docker compose rm -f \
    infra-setup mongo-setup redis-setup s3-setup
