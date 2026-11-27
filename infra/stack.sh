#!/bin/bash
set -euo pipefail

base_compose_file="${WORKSPACE_ROOT:?}/infra/compose.yml"
stack_test_pid=

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
        group)
            : "${1:?test group command required}"
            if [[ ${NEST_SEED_TEST_WORKSPACE-} == "$WORKSPACE_ROOT" ]]; then exec "$@"; fi
            # 자식 테스트는 컨테이너만 정리하고, 그룹이 끝나면 개발 인프라를 복구한다.
            set -- env "NEST_SEED_TEST_WORKSPACE=$WORKSPACE_ROOT" "$@"
            mode='test'
            ;;
        *) echo "Unknown stack command: $mode" >&2; return 2 ;;
    esac

    validate_stack "${services[@]}"
    if [[ $mode == test && ${NEST_SEED_TEST_WORKSPACE-} == "$WORKSPACE_ROOT" ]]; then
        # 본문이 실패해도 컨테이너를 정리한 뒤 그 종료 코드를 실행기에 돌려준다.
        set +e
        (
            set -e
            start_stack "${services[@]}"
            "$@"
        )
        local status=$?
        set -e
        if ((status)); then stack_diagnostics; fi
        clear_stack
        exit "$status"
    fi

    trap 'finish_stack "$?" restore' EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    trap 'exit 129' HUP
    clear_stack
    if [[ $mode != test && ${services[*]} == infra-setup ]]; then trap 'finish_stack "$?"' EXIT; fi
    start_stack "${services[@]}"
    if [[ $mode == test ]]; then
        # 작업 그룹 전체가 종료된 뒤에만 Compose 환경을 교체한다.
        set -m
        "$@" </dev/null &
        stack_test_pid=$!
        wait "$stack_test_pid"
        stack_test_pid=
    else
        trap - EXIT
    fi
    exit 0
}

validate_stack() {
    # down은 설정을 읽지 못해도 프로젝트 라벨로 대상을 찾을 수 있다. 먼저 설정과 요청한 서비스를 확인한다.
    docker compose --profile '*' config --quiet -- "$@"
}

start_stack() {
    if [[ $* == infra-setup ]]; then
        start_infra
    elif (($#)); then
        start_services "$@"
    fi
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
