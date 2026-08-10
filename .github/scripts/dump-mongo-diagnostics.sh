#!/usr/bin/env bash
set -uo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
workspace_root="${WORKSPACE_ROOT:-$(cd "${script_dir}/../.." && pwd)}"
compose_directory="${workspace_root}/infra"
compose_file="${compose_directory}/compose.yml"
node_diagnostics="${script_dir}/mongo-node-diagnostics.js"
mongo_services=(mongo1 mongo2 mongo3)
query_timeout_seconds="${MONGO_DIAGNOSTICS_TIMEOUT_SECONDS:-35}"

echo "=== MongoDB diagnostics @ $(date -u +'%Y-%m-%dT%H:%M:%SZ') ==="

if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is unavailable; MongoDB diagnostics skipped"
    exit 0
fi

compose=(docker compose --project-directory "${compose_directory}" -f "${compose_file}")

echo "=== MongoDB compose state ==="
timeout 8s "${compose[@]}" ps -a "${mongo_services[@]}" 2>&1 || \
    echo "MongoDB compose state timed out or failed"

container_ids=()
declare -A container_by_service=()
for service in "${mongo_services[@]}"; do
    container_id="$(timeout 5s "${compose[@]}" ps -q "${service}" 2>/dev/null || true)"
    if [ -n "${container_id}" ]; then
        container_by_service["${service}"]="${container_id}"
        container_ids+=("${container_id}")
    fi
done

if [ "${#container_ids[@]}" -gt 0 ]; then
    timeout 8s docker inspect --format \
        'name={{.Name}} status={{.State.Status}} running={{.State.Running}} oomKilled={{.State.OOMKilled}} exitCode={{.State.ExitCode}} restartCount={{.RestartCount}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} startedAt={{.State.StartedAt}} finishedAt={{.State.FinishedAt}}' \
        "${container_ids[@]}" 2>&1 || echo "MongoDB docker inspect timed out or failed"

    echo "=== MongoDB container resources ==="
    timeout 10s docker stats --no-stream "${container_ids[@]}" 2>&1 || \
        echo "MongoDB docker stats timed out or failed"
fi

echo "=== Runner pressure ==="
if command -v uptime >/dev/null 2>&1; then
    uptime 2>&1 || true
fi
if command -v free >/dev/null 2>&1; then
    free -h 2>&1 || true
fi
timeout 5s df -h "${workspace_root}" 2>&1 || echo "df timed out or failed"
if command -v vmstat >/dev/null 2>&1; then
    timeout 5s vmstat 1 3 2>&1 || echo "vmstat timed out or failed"
fi

dump_mongo_node() {
    local service="$1"
    local container_id="${container_by_service[${service}]:-}"

    echo "=== MongoDB node: ${service} ==="
    if [ -z "${container_id}" ]; then
        echo "${service} container is unavailable"
        return
    fi

    if [ "$(timeout 5s docker inspect --format '{{.State.Running}}' "${container_id}" 2>/dev/null)" != 'true' ]; then
        echo "${service} container is not running"
        return
    fi

    local mongo_uri='mongodb://localhost:27016/admin?directConnection=true&serverSelectionTimeoutMS=3000&connectTimeoutMS=3000&socketTimeoutMS=5000&minPoolSize=0&maxPoolSize=1'
    if ! timeout "${query_timeout_seconds}s" docker exec -i "${container_id}" \
        mongosh "${mongo_uri}" --quiet --file /dev/stdin <"${node_diagnostics}"; then
        echo "${service} diagnostics timed out or failed"
    fi
}

if ! diagnostics_directory="$(mktemp -d)"; then
    echo "Unable to create a temporary directory; MongoDB node queries skipped"
    exit 0
fi

cleanup() {
    local service
    local output_file
    for service in "${mongo_services[@]}"; do
        output_file="${diagnostics_directory}/${service}.out"
        if [ -e "${output_file}" ]; then
            rm -- "${output_file}"
        fi
    done
    rmdir -- "${diagnostics_directory}" 2>/dev/null || true
}
trap cleanup EXIT

query_pids=()
for service in "${mongo_services[@]}"; do
    dump_mongo_node "${service}" >"${diagnostics_directory}/${service}.out" 2>&1 &
    query_pids+=("$!")
done

for query_pid in "${query_pids[@]}"; do
    wait "${query_pid}" || true
done

for service in "${mongo_services[@]}"; do
    cat "${diagnostics_directory}/${service}.out"
done

exit 0
