#!/bin/bash
set -e
. "$(dirname "$0")/common.cfg"

docker_compose --profile apps down
docker_compose --profile apps up -d --build

docker wait ${PROJECT_NAME}-apps-setup
docker rm ${PROJECT_NAME}-apps-setup
