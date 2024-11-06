#!/bin/bash
set -e
. "$(dirname "$0")"/common.cfg

docker_compose --profile infra down --volumes --remove-orphans --timeout 0
docker_compose --profile infra up -d

check_and_remove() {
    container=$1

    for ((i = 1; i <= 10; i++)); do
        status=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null)
        if [ "$status" == "exited" ]; then
            docker rm "$container"
            break
        fi
        echo "waiting: $container"
        sleep 1
    done
}

check_and_remove mongo-key-generator
check_and_remove mongo-cluster-setup
check_and_remove redis-cluster-setup
