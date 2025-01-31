#!/bin/bash
set -e
. "$(dirname "$0")/common.cfg"

# 입력값 받기
if [ "$1" == "redis" ]; then
    docker exec -it "${REDIS_HOST1}" redis-cli -c -a $REDIS_PASSWORD
elif [ "$1" == "mongo" ]; then
    docker exec -it "${MONGO_DB_HOST1}" mongosh -u "$MONGO_DB_USERNAME" -p "$MONGO_DB_PASSWORD" --authenticationDatabase admin
elif [ "$1" == "kafka" ]; then
    echo "--bootstrap-server ${KAFKA_BROKER1}:${KAFKA_PORT},${KAFKA_BROKER2}:${KAFKA_PORT},${KAFKA_BROKER3}:${KAFKA_PORT}"
    docker exec -it $KAFKA_BROKER1 sh
else
    echo "Usage: $0 {redis|mongo|kafka}"
    exit 1
fi
