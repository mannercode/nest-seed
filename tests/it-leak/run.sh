#!/bin/bash
# it block 단위 메모리 추이. apps/api 의 통합 spec 을 그대로 실행하되
# afterEach 로 process.memoryUsage() 를 stderr 에 찍는다. spec 안 it block
# 들 사이에서 누수가 누적되는지 확인.
#
# 사용법:
#   bash tests/it-leak/run.sh <spec-path>...
# 예:
#   bash tests/it-leak/run.sh src/__tests__/integration/core/movies.spec.ts
#
# spec-path 는 apps/api 기준. 인프라가 떠 있어야 한다.
set -Eeuo pipefail
cd "$(dirname "$0")"

set -a
source ../../.devcontainer/infra/.env
set +a

WS_ROOT="$(cd ../.. && pwd)"
cd ../../apps/api
JEST=../../node_modules/.bin/jest

if [ "$#" -eq 0 ]; then
    echo "usage: $0 <spec-path>..." >&2
    exit 2
fi

# cwd 가 apps/api 라 'src/__tests__/...' 경로는 그대로, 'tests/...' 경로는
# workspace root 기준이라 절대경로로 변환해 jest 의 path matcher 에 정확히
# 맞춰준다.
args=()
for arg; do
    case "$arg" in
        /*) args+=("$arg") ;;
        tests/*) args+=("$WS_ROOT/$arg") ;;
        *) args+=("$arg") ;;
    esac
done

NODE_OPTIONS='--experimental-vm-modules' "$JEST" \
    --config ../../tests/it-leak/jest.config.js \
    --maxWorkers=1 \
    --no-coverage \
    --coverageThreshold='{}' \
    --forceExit \
    "${args[@]}" 2>&1 | grep --line-buffered -E "^\[|Tests:|Time:|FAIL|Error" || true
