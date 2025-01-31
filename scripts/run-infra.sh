#!/bin/bash
set -e
. "$(dirname "$0")/common.cfg"

docker_compose --profile kafka down --volumes --timeout 0
docker_compose --profile kafka up -d

# SETUP_CONTAINERS="${PROJECT_NAME}-mongo-key-generator ${PROJECT_NAME}-mongo-setup ${PROJECT_NAME}-redis-setup ${PROJECT_NAME}-kafka-setup"
SETUP_CONTAINERS="${PROJECT_NAME}-kafka-setup"

for container in $SETUP_CONTAINERS; do
    if [ "$(docker wait "$container")" -ne 0 ]; then
        exit 1
    else
        docker rm -v "$container"
    fi
done

bash $(dirname "$0")/kafka-create-topics.sh
