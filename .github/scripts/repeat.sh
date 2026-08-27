#!/usr/bin/env bash
set -Eeuo pipefail

repeat_count="$1"
shift

dump_postgresql_diagnostics () {
    local compose_file="${WORKSPACE_ROOT:?WORKSPACE_ROOT must be set}/infra/compose.yml"
    local postgres_id

    postgres_id=$(timeout 8s docker compose --project-directory "${WORKSPACE_ROOT}/infra" -f "${compose_file}" ps -q temporal-postgresql 2>/dev/null || true)
    if [ -z "${postgres_id}" ]; then
        echo "=== PostgreSQL diagnostics unavailable: temporal-postgresql is not running ==="
        return
    fi

    echo "=== PostgreSQL diagnostics ==="
    # 진단 쿼리가 포화된 DB를 더 오래 붙잡거나 원래 실패 상태를 가리지 않도록 실행 시간을 제한한다.
    if ! timeout 20s docker exec -i \
        -e PGCONNECT_TIMEOUT=5 \
        -e PGOPTIONS='-c statement_timeout=10000' \
        "${postgres_id}" psql -X -v ON_ERROR_STOP=1 -U temporal -d temporal <<'SQL'
\pset pager off
\pset null '[null]'

SELECT now() AS captured_at,
       current_setting('max_connections') AS max_connections,
       current_setting('checkpoint_timeout') AS checkpoint_timeout,
       current_setting('max_wal_size') AS max_wal_size;

SELECT num_timed,
       num_requested,
       write_time AS write_time_ms,
       sync_time AS sync_time_ms,
       buffers_written,
       stats_reset
FROM pg_stat_checkpointer;

SELECT backend_type,
       COALESCE(wait_event_type, '[none]') AS wait_event_type,
       COALESCE(wait_event, '[none]') AS wait_event
FROM pg_stat_activity
WHERE backend_type IN ('checkpointer', 'background writer', 'walwriter')
ORDER BY backend_type;

SELECT datname,
       numbackends,
       xact_commit,
       xact_rollback,
       blks_read,
       blks_hit,
       temp_files,
       pg_size_pretty(temp_bytes) AS temp_bytes,
       deadlocks,
       blk_read_time,
       blk_write_time
FROM pg_stat_database
WHERE datname IN ('temporal', 'temporal_visibility')
ORDER BY datname;

SELECT datname,
       application_name,
       COALESCE(state, '[null]') AS state,
       COALESCE(wait_event_type, '[none]') AS wait_event_type,
       COALESCE(wait_event, '[none]') AS wait_event,
       count(*) AS connections
FROM pg_stat_activity
WHERE datname IN ('temporal', 'temporal_visibility')
GROUP BY datname, application_name, state, wait_event_type, wait_event
ORDER BY datname, connections DESC, application_name, state;

SELECT pid,
       datname,
       application_name,
       COALESCE(state, '[null]') AS state,
       COALESCE(wait_event_type, '[none]') AS wait_event_type,
       COALESCE(wait_event, '[none]') AS wait_event,
       clock_timestamp() - query_start AS query_age,
       clock_timestamp() - xact_start AS transaction_age,
       left(query, 200) AS query
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
  AND datname IN ('temporal', 'temporal_visibility')
  AND state IS DISTINCT FROM 'idle'
ORDER BY query_start NULLS LAST;
SQL
    then
        echo "PostgreSQL diagnostics timed out or failed"
    fi
}

on_failure () {
    local exit_code=$?

    # 진단 자체가 실패해도 최초 테스트 실패 코드와 로그 수집을 덮지 않는다.
    trap - ERR
    set +e

    timeout --kill-after=5s 110s \
        bash "${WORKSPACE_ROOT}/.github/scripts/dump-mongo-diagnostics.sh" || \
        echo "MongoDB diagnostics timed out or failed"
    timeout 10s docker ps -a || echo "docker ps timed out or failed"
    timeout 15s docker stats -a --no-stream || echo "docker stats timed out or failed"
    dump_postgresql_diagnostics

    for id in $(timeout 10s docker ps -aq); do
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
