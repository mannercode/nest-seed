#!/bin/bash
set -e
. "$(dirname "$0")/common.cfg"

docker_compose --profile infra down --volumes --timeout 0
docker_compose --profile infra up -d

SETUP_CONTAINERS="mongo-key-generator mongo-setup redis-setup nats-setup"

for CONTAINER in $SETUP_CONTAINERS; do
    CONTAINER_NAME="${PROJECT_NAME}-${CONTAINER}"

    if [ "$(docker wait "$CONTAINER_NAME")" -ne 0 ]; then
        echo "Error: Container '$CONTAINER_NAME' failed."
        exit 1
    else
        docker rm -v "$CONTAINER_NAME"
    fi
done
