#!/bin/bash
# Minimal repro: jest + 큰 npm 모듈 require 만 했을 때 testFile 사이의 RSS
# 점프를 측정한다. 코드베이스/실제 connection 무관.
#
# 사용법: bash tests/minimal/run.sh [true|false|both]
#   - true:  resetModules:true 만 실행
#   - false: resetModules:false 만 실행
#   - both (기본): 두 모드 차례로 실행해 비교
#
# repro 설계: 같은 spec*.test.js 4 개 (동일 코드 다른 path) 를 한 jest 실행에
# 넣어 jest 가 testFile 을 어떻게 회수하는지 본다. snapshot tool 은 안 쓴다
# (호출당 ~1GB 의 RSS 누적 부수효과를 발생시켜 측정 자체가 noise 였음).
set -Eeuo pipefail
cd "$(dirname "$0")"

# tests/minimal 에서 npm 모듈을 찾을 수 있도록 root node_modules 심볼릭 링크
if [ ! -e node_modules ]; then
    ln -s ../../node_modules node_modules
fi

JEST=node_modules/.bin/jest
mode="${1:-both}"

run_one() {
    local label="$1"
    local config="$2"
    echo "=========================================="
    echo "[$label]"
    echo "=========================================="
    NODE_OPTIONS='--expose-gc' "$JEST" --config "$config" --maxWorkers=1 2>&1 \
        | grep -E "probe|Tests:|Time:" || true
    echo
}

case "$mode" in
    true) run_one "resetModules=true" jest.config.true.js ;;
    false) run_one "resetModules=false" jest.config.false.js ;;
    both)
        run_one "resetModules=true" jest.config.true.js
        run_one "resetModules=false" jest.config.false.js
        ;;
    *) echo "usage: $0 [true|false|both]"; exit 2 ;;
esac
