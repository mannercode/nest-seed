#!/bin/bash
set -e
. "$(dirname "$0")"/common.cfg

docker_compose --profile infra down --volumes --timeout 0
docker_compose --profile infra up -d

SETUP_CONTAINERS="${PROJECT_NAME}-mongo-key-generator ${PROJECT_NAME}-mongo-cluster-setup ${PROJECT_NAME}-redis-cluster-setup"

docker wait $SETUP_CONTAINERS
docker rm -v $SETUP_CONTAINERS
