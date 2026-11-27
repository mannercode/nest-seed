#!/bin/bash
set -euo pipefail

base_compose_file="${WORKSPACE_ROOT:?}/infra/compose.yml"
export COMPOSE_FILE="$base_compose_file"
test_pid=

clear_stack() {
    docker compose down --volumes --remove-orphans --timeout 0
}

start_services() {
    if [[ $# == 1 && $1 == infra-setup ]]; then
        docker compose run --rm -T infra-setup && docker compose rm --force --volumes
    else
        docker compose up -d --build --wait -- "$@"
    fi
}

stack_diagnostics() {
    timeout 10s docker compose ps --all >&2 || :
    timeout 30s docker compose logs --no-color --tail 50 >&2 || :
}

finish_stack() {
    local status=$1
    trap - EXIT
    trap '' HUP INT TERM
    if [[ -n $test_pid ]] && kill -TERM -- "-$test_pid" 2>/dev/null; then
        wait "$test_pid" || :
        # pnpm이 먼저 종료돼도 자식의 Compose 정리가 끝난 뒤 개발 인프라를 복구한다.
        pidwait -g "$test_pid" || [[ $? == 1 ]] || exit 1
    fi
    if ((status)); then stack_diagnostics; fi
    clear_stack || exit 1
    export COMPOSE_FILE="$base_compose_file"
    if [[ ${2-} == restore ]] && ! start_services infra-setup; then
        stack_diagnostics
        clear_stack
        exit 1
    fi
    exit "$status"
}

trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

run_test() {
    local service=$1
    shift
    if [[ $service != -- ]]; then start_services "$service"; fi
    "$@"
}

with_test_stack() {
    : "${1:?test service or -- required}" "${2:?test command required}"
    local -a services=()
    if [[ $1 != -- ]]; then services=("$1"); fi
    docker compose config --quiet -- "${services[@]}"

    # 자식 테스트는 자기 환경을 정리하고, 마지막 개발 인프라 복구는 바깥 명령이 맡는다.
    if [[ ${NEST_SEED_TEST_WORKSPACE-} == "$WORKSPACE_ROOT" ]]; then
        trap 'finish_stack "$?"' EXIT
        (run_test "$@")
        exit 0
    fi
    trap 'finish_stack "$?" restore' EXIT
    clear_stack
    set -m
    NEST_SEED_TEST_WORKSPACE="$WORKSPACE_ROOT" run_test "$@" </dev/null &
    test_pid=$!
    wait "$test_pid"
    test_pid=
    exit 0
}

if [[ ${BASH_SOURCE[0]} != "$0" ]]; then return; fi
command=${1:?expected up, reset or test}
shift
case "$command" in
    up) if (($# == 0)); then set -- web; fi ;;
    reset)
        if (($#)); then echo 'reset takes no arguments' >&2; exit 2; fi
        set -- infra-setup ;;
    test) with_test_stack "$@" ;;
    *) echo "Unknown command: $command" >&2; exit 2 ;;
esac
docker compose config --quiet -- "$@"
if [[ $# == 1 && $1 == infra-setup ]]; then
    trap 'finish_stack "$?"' EXIT
else
    trap 'finish_stack "$?" restore' EXIT
fi
clear_stack
start_services "$@"
trap - EXIT
