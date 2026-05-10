#!/bin/bash
# 각 native client 별로 connect → close 를 N 번 반복하면서 RSS/heap/external/
# arrayBuffers 추이를 본다. 사용 안 하고 연결만 만들었다 닫아도 메모리 누수
# 가 있는지 분리 측정.
#
# 사용법:
#   bash tests/connection-leak/run.sh                # 전체 (N=50)
#   bash tests/connection-leak/run.sh mongoose       # 한 client 만
#   LEAK_N=100 bash tests/connection-leak/run.sh     # 반복 횟수 변경
#
# 가능한 client:
#   mongo-client | mongoose-conn | temporal-conn | redis-cluster | nats-conn | s3-client
set -Eeuo pipefail
cd "$(dirname "$0")"

if [ ! -e node_modules ]; then
    ln -s ../../node_modules node_modules
fi

set -a
source ../../.devcontainer/infra/.env
set +a

JEST=node_modules/.bin/jest
TARGET="${1:-}"

run_one() {
    local match="$1"
    NODE_OPTIONS='--experimental-vm-modules' "$JEST" \
        --config jest.config.js \
        --maxWorkers=1 \
        --no-coverage \
        --coverageThreshold='{}' \
        --forceExit \
        --testPathPatterns "$match" \
        2>&1 | grep --line-buffered -E "conn-leak|Tests:|Time:|FAIL|Error" || true
}

if [ -n "$TARGET" ]; then
    run_one "$TARGET"
else
    for spec in mongo-client mongoose-conn temporal-conn redis-cluster nats-conn s3-client; do
        echo "=========================================="
        echo "[$spec]"
        echo "=========================================="
        run_one "$spec"
        echo
    done
fi
