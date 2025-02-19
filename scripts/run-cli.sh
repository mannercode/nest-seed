#!/bin/bash
set -e
. "$(dirname "$0")/common.cfg"
. $TEST_ENV_FILE

# 입력값 받기
if [ "$1" == "redis" ]; then
    docker exec -it "${REDIS_HOST1}" redis-cli -c -a $REDIS_PASSWORD
elif [ "$1" == "mongo" ]; then
    docker exec -it "${MONGO_HOST1}" mongosh -u "$MONGO_USERNAME" -p "$MONGO_PASSWORD" --authenticationDatabase admin
else
    echo "Usage: $0 {redis|mongo}"
    exit 1
fi
