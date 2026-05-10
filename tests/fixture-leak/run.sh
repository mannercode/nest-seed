#!/bin/bash
# fixture-leak.spec.ts 를 실행. createAppTestContext 를 N 번 부팅·teardown
# 하면서 매번 GC 후 메모리 측정.
#
# 사용법: bash tests/fixture-leak/run.sh [N]
#   - N: 부팅 횟수 (기본 6). 환경변수 FIXTURE_LEAK_N 으로도 전달 가능.
#
# 실행 전 인프라가 떠 있어야 한다 (mongo/redis/nats/temporal/minio):
#   bash .devcontainer/infra/reset.sh
set -Eeuo pipefail
cd "$(dirname "$0")"

if [ ! -e node_modules ]; then
    ln -s ../../node_modules node_modules
fi

# apps/api 의 jest.global.js / jest.setup.js 가 process.loadEnvFile('.env')
# 로 apps/api/.env 를 읽으므로 cwd 를 apps/api 로 두고 실행한다.
# devcontainer 가 .devcontainer/infra/.env 의 MONGO_URI 등을 process env 로
# 못 넣는 케이스를 대비해 명시적으로 source.
export FIXTURE_LEAK_N="${1:-${FIXTURE_LEAK_N:-6}}"
set -a
source ../../.devcontainer/infra/.env
set +a

cd ../../apps/api
JEST=../../node_modules/.bin/jest

# --forceExit: 통합 fixture 가 close 후에도 일부 native handle (gRPC/mongo)
# 이 잠시 살아있어 jest 가 "did not exit" 으로 hang 한다. 측정만 끝나면
# 강제 종료해 결과 빠르게 뽑는다.
NODE_OPTIONS='--experimental-vm-modules --expose-gc' "$JEST" \
    --config ../../tests/fixture-leak/jest.config.js \
    --maxWorkers=1 \
    --no-coverage \
    --coverageThreshold='{}' \
    --forceExit \
    2>&1 | grep --line-buffered -E "fixture-leak|Tests:|Time:|FAIL|Error" || true
