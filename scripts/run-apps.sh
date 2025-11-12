#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/common.cfg"

docker_compose() (
	docker compose --compatibility \
		-f $PROJECT_ROOT/compose.yml \
		--env-file $TEST_ENV_FILE \
		$@
)

docker_compose down --volumes --timeout 0

# TODO logstash 붙이면 삭제해라
. $TEST_ENV_FILE
sudo rm -rf $WORKSPACE_ROOT/_output
mkdir -p $WORKSPACE_ROOT/$LOG_DIRECTORY
mkdir -p $WORKSPACE_ROOT/$FILE_UPLOAD_DIRECTORY

docker_compose up -d --build

docker wait apps-setup
docker rm apps-setup
