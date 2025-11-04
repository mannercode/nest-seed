#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/common.cfg"
. $TEST_ENV_FILE

docker_compose --profile infra down --volumes --timeout 0

# TODO log나 upload 같은 폴더 제거하면 sudo가 필요 없다.
sudo rm -rf $PROJECT_ROOT/_output
mkdir -p $PROJECT_ROOT/$LOG_DIRECTORY
mkdir -p $PROJECT_ROOT/$FILE_UPLOAD_DIRECTORY

docker_compose --profile infra up -d

SETUP_CONTAINERS="mongo-key-generator mongo-setup redis-setup nats-setup minio-setup"

for CONTAINER in $SETUP_CONTAINERS; do
    if [ "$(docker wait "${CONTAINER}")" -ne 0 ]; then
        echo "Error: Container '${CONTAINER}' failed."
        exit 1
    else
        docker rm -v "${CONTAINER}"
    fi
done
