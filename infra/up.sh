#!/bin/bash
set -euo pipefail

base_compose_file="${WORKSPACE_ROOT:?}/infra/compose.yml"
export COMPOSE_FILE="$base_compose_file"

clear_stack() {
    # 기본 Compose 파일에 없는 실행 중인 E2E 컨테이너도 함께 정리한다.
    docker ps -aq --filter "label=com.docker.compose.project=${COMPOSE_PROJECT_NAME:?}" \
        --filter 'label=com.docker.compose.oneoff=True' | xargs -r docker rm --force --volumes || return "$?"
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
    if ((status)); then stack_diagnostics; fi
    export COMPOSE_FILE="$base_compose_file"
    clear_stack || exit 1
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

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
    if (($# == 0)); then set -- web; fi
    if [[ $1 == --reset ]]; then
        if (($# != 1)); then echo 'reset takes no arguments' >&2; exit 2; fi
        set -- infra-setup
    fi
    docker compose config --quiet -- "$@"
    if [[ $# == 1 && $1 == infra-setup ]]; then
        trap 'finish_stack "$?"' EXIT
    else
        trap 'finish_stack "$?" restore' EXIT
    fi
    clear_stack
    start_services "$@"
    trap - EXIT
fi
