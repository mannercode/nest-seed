#!/bin/bash
set -Eeuo pipefail

# Compose는 대상 서비스 없이 down을 실행하면 설정을 읽지 못해도 프로젝트 라벨로 컨테이너를 찾는다.
# 앱과 개발 인프라가 프로젝트명을 공유하므로 유효한 설정의 서비스만 종료한다.
compose=(docker compose --profile '*')
configured=$("${compose[@]}" config --services)
if [[ -z "$configured" ]]; then
    echo "No Compose services configured for teardown" >&2
    exit 1
fi
options=()
services=()
while (($#)); do
    case "$1" in
        -t | --timeout | --rmi)
            options+=("$1" "${2:?missing value for $1}")
            shift
            ;;
        --remove-orphans | --remove-orphans=*)
            echo "Cannot use --remove-orphans because other services share the Compose project" >&2
            exit 1
            ;;
        --)
            shift
            services+=("$@")
            break
            ;;
        -*) options+=("$1") ;;
        *) services+=("$1") ;;
    esac
    shift
done
if ((${#services[@]})); then
    for service in "${services[@]}"; do
        if ! grep -Fxq -- "$service" <<<"$configured"; then
            echo "Unknown Compose service: $service" >&2
            exit 1
        fi
    done
else
    mapfile -t services <<<"$configured"
fi
exec "${compose[@]}" down "${options[@]}" --remove-orphans=false -- "${services[@]}"
