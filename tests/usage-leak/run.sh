#!/bin/bash
# 연결 후 "사용" 패턴별로 누수 검증.
#   http-superagent : express 서버 + superagent N 번 GET (사용자 HttpTestClient 라이브러리)
#   mongoose-crud   : mongoose insert + find N 번
#   s3-upload       : S3 put + get N 번
#
# 사용법:
#   bash tests/usage-leak/run.sh                # 전체
#   bash tests/usage-leak/run.sh http           # 한 패턴만
#   LEAK_N=300 bash tests/usage-leak/run.sh     # 반복 횟수
#   LEAK_PAYLOAD_KB=64 bash tests/usage-leak/run.sh   # http/s3 payload 크기
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
    for spec in http-superagent mongoose-crud s3-upload; do
        echo "=========================================="
        echo "[$spec]"
        echo "=========================================="
        run_one "$spec"
        echo
    done
fi
