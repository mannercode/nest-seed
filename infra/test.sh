#!/bin/bash
set -euo pipefail
source "${WORKSPACE_ROOT:?}/infra/up.sh"
test_pid=

run_test_command() {
    local service=$1
    shift
    if [[ $service != -- ]]; then start_services "$service"; fi
    "$@"
}

finish_tests() {
    local status=$1
    trap '' HUP INT TERM
    if [[ -n ${test_pid-} ]] && kill -TERM -- "-$test_pid" 2>/dev/null; then
        wait "$test_pid" || :
    fi
    finish_stack "$status" restore
}

with_test_stack() {
    : "${1:?test service or -- required}" "${2:?test command required}"
    local -a services=()
    if [[ $1 != -- ]]; then services=("$1"); fi
    docker compose config --quiet -- "${services[@]}"

    # 묶어서 실행할 때 각 테스트는 자기 컨테이너만 정리하고, 바깥 명령이 개발 인프라를 복구한다.
    if [[ ${NEST_SEED_TEST_WORKSPACE-} == "$WORKSPACE_ROOT" ]]; then
        trap 'finish_stack "$?"' EXIT
        (run_test_command "$@")
    else
        trap 'finish_tests "$?"' EXIT
        clear_stack
        set -m
        NEST_SEED_TEST_WORKSPACE="$WORKSPACE_ROOT" run_test_command "$@" </dev/null &
        test_pid=$!
        wait "$test_pid"
        test_pid=
    fi
    exit 0
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then with_test_stack "$@"; fi
