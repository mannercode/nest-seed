#!/bin/bash
set -euo pipefail

base_compose_file="${WORKSPACE_ROOT:?}/infra/compose.yml"
stack_test_pid=

# 호출한 workspace에서 명령을 실행하고, 환경을 복구할 때까지 같은 잠금을 유지한다.
with_stack() {
    local mode=$1
    shift
    export COMPOSE_FILE="$base_compose_file"
    if [[ ${1-} == -f ]]; then
        COMPOSE_FILE+=":${2:?Compose override file required}"
        shift 2
    fi

    local -a services=()
    case "$mode" in
        reset)
            if (($#)); then echo 'reset takes no arguments' >&2; return 2; fi
            services=(infra-setup)
            ;;
        up)
            if (($# == 0)); then set -- web; fi
            services=("$@")
            shift "$#"
            ;;
        test)
            if [[ ${1:?test service or -- required} != -- ]]; then services=("$1"); fi
            shift
            : "${1:?test command required}"
            ;;
        *) echo "Unknown stack command: $mode" >&2; return 2 ;;
    esac

    exec 9<"${WORKSPACE_ROOT}/infra"
    flock 9
    # down은 설정을 읽지 못해도 프로젝트 라벨로 대상을 찾을 수 있다. 먼저 설정과 요청한 서비스를 확인한다.
    docker compose --profile '*' config --quiet -- "${services[@]}"

    trap 'finish_stack "$?" restore' EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    trap 'exit 129' HUP
    clear_stack
    if [[ ${services[*]} == infra-setup ]]; then
        if [[ $mode != test ]]; then trap 'finish_stack "$?"' EXIT; fi
        start_infra
    elif ((${#services[@]})); then
        start_services "${services[@]}"
    fi
    if [[ $mode == test ]]; then
        # 작업 그룹 전체가 종료된 뒤에만 Compose 환경을 교체한다.
        set -m
        "$@" </dev/null 9<&- &
        stack_test_pid=$!
        wait "$stack_test_pid"
        stack_test_pid=
    else
        trap - EXIT
    fi
    exit 0
}

clear_stack() {
    # down은 실행 중인 compose run 컨테이너를 남긴다. 중단된 브라우저나 k6도 볼륨을 비우기 전에 정리한다.
    docker ps -aq --filter "label=com.docker.compose.project=${COMPOSE_PROJECT_NAME:?}" \
        --filter 'label=com.docker.compose.oneoff=True' | xargs -r docker rm --force --volumes || return "$?"
    docker compose --profile '*' down --volumes --remove-orphans --timeout 0
}

start_services() {
    docker compose up -d --build --wait -- "$@"
}

start_infra() {
    docker compose run --rm -T infra-setup && docker compose rm --force --volumes
}

stack_diagnostics() {
    timeout 10s docker compose --profile '*' ps --all >&2 || :
    timeout 30s docker compose --profile '*' logs --no-color --tail 50 >&2 || :
}

finish_stack() {
    local status=$1
    trap - EXIT
    trap '' HUP INT TERM
    if [[ -n $stack_test_pid ]]; then
        if kill -TERM -- "-$stack_test_pid" 2>/dev/null; then wait "$stack_test_pid" || :; fi
    fi
    if ((status)); then stack_diagnostics; fi
    export COMPOSE_FILE="$base_compose_file"
    clear_stack || exit 1
    if [[ ${2-} == restore ]] && ! start_infra; then
        stack_diagnostics
        clear_stack
        exit 1
    fi
    exit "$status"
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then with_stack "$@"; fi
