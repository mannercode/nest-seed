#!/bin/bash
set -Eeuo pipefail
cd -- "$(dirname -- "$0")"

# API 테스트 스택 기동, 단일 race 시나리오 실행과 정리를 한 번에 수행한다.
# 사용: pnpm -C infra run race <scenario-name>
#  예) pnpm -C infra run race sse-fanout-race

export COMPOSE_FILE="${WORKSPACE_ROOT:?}/infra/compose.apps.yml"

compose=(docker compose --profile replicas)

list_scenarios() {
    echo "Scenarios:"
    for f in ./*.js; do
        name="$(basename "$f" .js)"
        [ "$name" = "race-common" ] && continue
        echo "  $name"
    done
}

TEST_NAME="${1:-}"
if [ -z "${TEST_NAME}" ]; then
    echo "Usage: pnpm -C infra run race <scenario>"
    list_scenarios
    exit 0
fi
TEST_SCRIPT="${TEST_NAME}.js"

if [ ! -f "${TEST_SCRIPT}" ]; then
    echo "Error: no test script at ${TEST_SCRIPT}"
    list_scenarios
    exit 1
fi

SERVER_URL="http://nginx"
cleanup() {
    echo ""
    echo "Tearing down..."
    "${compose[@]}" down -v -t 0 nginx replica-api
}

dump_diagnostics() {
    local service cid cname

    echo ""
    echo "=== container diagnostics ==="
    date --utc --iso-8601=seconds
    "${compose[@]}" ps -a nginx replica-api || true

    for service in nginx replica-api; do
        timeout --kill-after=2s 10s "${compose[@]}" stats --all --no-stream --format json "${service}" \
            || echo "[diagnostics] container resource collection failed: ${service}" >&2
    done

    for cid in $("${compose[@]}" ps -aq nginx replica-api 2>/dev/null); do
        cname=$(docker inspect --format '{{.Name}} ({{.State.Status}})' "${cid}" 2>/dev/null || echo "${cid}")
        docker inspect --format 'name={{.Name}} state={{json .State}} restarts={{.RestartCount}}' "${cid}" \
            || echo "[diagnostics] container state collection failed: ${cid}" >&2
        echo "--- logs ${cname} (last 200) ---"
        docker logs --tail 200 "${cid}" 2>&1 || true
        echo ""
    done

    # 복제 지연은 ping health만으로 알 수 없으므로 각 노드에 직접 상태를 묻는다.
    # 상태 조회가 남기는 로그에 실패 직전 기록이 밀리지 않도록 기존 로그를 먼저 수집한다.
    for service in mongo1 mongo2 mongo3; do
        echo "--- MongoDB diagnostics: ${service} ---"
        timeout --kill-after=2s 10s docker compose -f "${WORKSPACE_ROOT}/infra/compose.yml" \
            exec -T "${service}" mongosh \
            'mongodb://localhost:27017/?directConnection=true&serverSelectionTimeoutMS=2000&connectTimeoutMS=2000&socketTimeoutMS=5000' \
            --quiet --eval '
                print(EJSON.stringify({ replicaSet: db.adminCommand({ replSetGetStatus: 1 }) }))
                const s = db.serverStatus()
                print(EJSON.stringify({ server: {
                    host: s.host,
                    localTime: s.localTime,
                    uptime: s.uptime,
                    connections: s.connections,
                    mem: s.mem,
                    globalLock: s.globalLock,
                    flowControl: s.flowControl,
                    repl: s.metrics.repl,
                    cache: {
                        bytes: s.wiredTiger.cache["bytes currently in the cache"],
                        maxBytes: s.wiredTiger.cache["maximum bytes configured"],
                        dirtyBytes: s.wiredTiger.cache["tracked dirty bytes in the cache"],
                        timeouts: s.wiredTiger.cache["operations timed out waiting for space in cache"]
                    },
                    journal: {
                        syncs: s.wiredTiger.log["log sync operations"],
                        syncMicros: s.wiredTiger.log["log sync time duration (usecs)"]
                    }
                } }))
            ' </dev/null || echo "[diagnostics] MongoDB state collection failed: ${service}" >&2
    done
}

bring_up_stack() {
    echo "Building 4-replica api test stack..."

    if ! "${compose[@]}" up -d --build --wait nginx; then
        echo "[FAIL] compose up failed before ${TEST_NAME} could start"
        dump_diagnostics
        exit 1
    fi

    echo ""
    "${compose[@]}" ps nginx replica-api
}

run_scenario() {
    echo ""
    echo "=== ${TEST_NAME} ==="
    if SERVER_URL="${SERVER_URL}" node --test --test-reporter=spec "${TEST_SCRIPT}"; then
        echo "[PASS] ${TEST_NAME}"
        return 0
    fi

    echo "[FAIL] ${TEST_NAME}"
    dump_diagnostics
    return 1
}

"${compose[@]}" down
trap cleanup EXIT
bring_up_stack
run_scenario
