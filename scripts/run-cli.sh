#!/bin/bash
set -e
. "$(dirname "$0")/common.cfg"
. $TEST_ENV_FILE

CLI_OPTIONS=("redis" "mongo")

if [ $# -ge 1 ]; then
    SELECTED_CLI="$1"
else
    echo -e "\nSelect CLI"

    SELECTED_CLI=$(prompt_selection "${CLI_OPTIONS[@]}")
fi

# 입력값 받기
if [ "$SELECTED_CLI" == "redis" ]; then
    docker exec -it "${REDIS_HOST1}" redis-cli -c -a $REDIS_PASSWORD
elif [ "$SELECTED_CLI" == "mongo" ]; then
    docker exec -it "${MONGO_HOST1}" mongosh -u "$MONGO_USERNAME" -p "$MONGO_PASSWORD" --authenticationDatabase admin
else
    echo "unknown cli: $SELECTED_CLI {${CLI_OPTIONS[@]}}"
    exit 1
fi
