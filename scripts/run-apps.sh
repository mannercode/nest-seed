#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/common.cfg"

docker_compose() (
	docker compose --compatibility \
		-f $PROJECT_ROOT/compose.yml \
		--env-file $TEST_ENV_FILE \
		--env-file $INFRA_ENV_FILE \
		$@
)

docker_compose down --volumes --timeout 0
docker_compose up -d --build

docker wait apps-setup
docker rm apps-setup
