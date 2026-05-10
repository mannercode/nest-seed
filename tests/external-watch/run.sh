#!/bin/bash
# 외부 RSS 추적: jest 프로세스에 측정 코드를 박지 않고, /proc 에서 1 초마다
# RSS/VmSize 를 읽어 시계열로 기록한다. 측정 도구가 jest 메모리에 영향 안
# 주는 게 목적.
#
# 사용법:
#   bash tests/external-watch/run.sh <spec-path>...
# 예:
#   bash tests/external-watch/run.sh src/__tests__/integration/core/movies.spec.ts
#   bash tests/external-watch/run.sh \
#       src/__tests__/integration/application/showtime-creation.spec.ts \
#       src/__tests__/integration/infrastructure/assets.spec.ts \
#       src/__tests__/integration/core/movies.spec.ts
#
# spec-path 는 apps/api 기준. 인프라 (mongo/redis/nats/temporal/minio) 가
# 떠 있어야 한다 — bash .devcontainer/infra/reset.sh
#
# 결과:
#   /tmp/jest-stdout.log   — jest 의 stdout/stderr 전체
#   /tmp/rss-timeline.tsv  — '#timestamp rss_kb vmsize_kb' 시계열
set -Eeuo pipefail
cd "$(dirname "$0")"

set -a
source ../../.devcontainer/infra/.env
set +a

cd ../../apps/api
JEST=../../node_modules/.bin/jest

if [ "$#" -eq 0 ]; then
    echo "usage: $0 <spec-path>..." >&2
    exit 2
fi

JEST_STDOUT=/tmp/jest-stdout.log
RSS_LOG=/tmp/rss-timeline.tsv

: > "$JEST_STDOUT"
: > "$RSS_LOG"

# --runInBand: 워커 fork 없이 메인 프로세스에서 직접 실행. 단일 PID 추적이
# 가능해 외부 RSS 측정이 단순해진다. (워커 fork 가 필요한 별도 측정은 다른
# 도구로.)
# --forceExit: 통합 fixture 의 native handle 이 일부 살아남아 jest 가 "did
# not exit" 으로 hang 한다. 그대로 두면 watch 루프가 무한 대기 + 프로세스
# 누적으로 시스템 메모리 잠식.
NODE_OPTIONS='--experimental-vm-modules' "$JEST" \
    --runInBand --no-coverage --coverageThreshold='{}' --forceExit \
    "$@" > "$JEST_STDOUT" 2>&1 &
JEST_PID=$!

trap 'kill -9 $JEST_PID 2>/dev/null || true' EXIT

echo "jest pid=$JEST_PID, watching RSS every 1s..."
echo "# timestamp rss_kb vmsize_kb peak_rss_kb" | tee "$RSS_LOG"

while kill -0 $JEST_PID 2>/dev/null; do
    if [ -r /proc/$JEST_PID/status ]; then
        rss=$(awk '/^VmRSS:/{print $2}' /proc/$JEST_PID/status 2>/dev/null || echo 0)
        vmsize=$(awk '/^VmSize:/{print $2}' /proc/$JEST_PID/status 2>/dev/null || echo 0)
        peak=$(awk '/^VmHWM:/{print $2}' /proc/$JEST_PID/status 2>/dev/null || echo 0)
        line="$(date +%s) ${rss} ${vmsize} ${peak}"
        echo "$line" | tee -a "$RSS_LOG"
    fi
    sleep 1
done

wait $JEST_PID || true
trap - EXIT

echo "==="
echo "jest stdout: $JEST_STDOUT"
echo "rss timeline: $RSS_LOG"
echo
echo "== jest 결과 요약 =="
grep -E "^(PASS|FAIL|Test Suites:|Tests:|Time:)" "$JEST_STDOUT" || tail -5 "$JEST_STDOUT"
