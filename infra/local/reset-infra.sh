#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

PROJECT_ROOT=$WORKSPACE_ROOT
TEST_ENV_FILE="$PROJECT_ROOT/.env.test"
INFRA_ENV_FILE=".env.infra"

docker_compose() (
	docker compose --compatibility \
		-f ./compose.yml \
		--env-file $TEST_ENV_FILE \
		--env-file $INFRA_ENV_FILE \
		$@
)

docker_compose down --volumes --timeout 0

# TODO logstash 붙이면 삭제해라
. $TEST_ENV_FILE
sudo rm -rf $WORKSPACE_ROOT/_output
mkdir -p $WORKSPACE_ROOT/$LOG_DIRECTORYㅋ
mkdir -p $WORKSPACE_ROOT/$FILE_UPLOAD_DIRECTORY

docker_compose up -d

SETUP_CONTAINERS=(mongo-key-generator mongo-setup redis-setup nats-setup minio-setup)

if docker wait ${SETUP_CONTAINERS[@]} | grep -qvE '^(0|0\r?)$'; then
	echo "Error: at least one setup container failed." >&2
	exit 1
fi

docker rm -v ${SETUP_CONTAINERS[@]} >/dev/null
