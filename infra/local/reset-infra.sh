#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

PROJECT_ROOT=$WORKSPACE_ROOT

docker_compose() (
	docker compose --compatibility \
		-f ./compose.yml \
		--env-file "$PROJECT_ROOT/.env" \
		--env-file "$PROJECT_ROOT/.env.infra" \
		$@
)

docker_compose down --volumes --timeout 0
docker_compose up -d

SETUP_CONTAINERS=(mongo-key-generator mongo-setup redis-setup nats-setup minio-setup)

if docker wait ${SETUP_CONTAINERS[@]} | grep -qvE '^(0|0\r?)$'; then
	echo "Error: at least one setup container failed." >&2
	exit 1
fi

docker rm -v ${SETUP_CONTAINERS[@]} >/dev/null
