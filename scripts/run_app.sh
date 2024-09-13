#!/bin/bash
set -e
. "$(dirname "$0")"/common.cfg
. $ENV_FILE

docker_compose --profile apps down
docker_compose --profile apps up -d --build

wait_for_service $PROJECT_NAME "docker logs $PROJECT_NAME 2>&1 | grep -q 'Application is running on:'"
