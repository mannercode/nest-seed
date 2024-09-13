#!/bin/bash
set -e
. "$(dirname "$0")"/common.cfg
. $ENV_FILE

run_mongo() (
  docker exec ${MONGO_DB_HOST1} mongosh -u ${MONGO_DB_USERNAME} -p ${MONGO_DB_PASSWORD} --authenticationDatabase admin --eval "$@"
)

docker_compose --profile infra down --volumes --remove-orphans --timeout 0
docker_compose --profile infra up -d

wait_for_service "${MONGO_DB_HOST1}" "run_mongo 'db.version()'"
run_mongo "
rs.initiate({
    _id: \"${MONGO_DB_REPLICA_NAME}\",
    members: [
        {_id: 0, host: \"${MONGO_DB_HOST1}\"},
        {_id: 1, host: \"${MONGO_DB_HOST2}\"},
        {_id: 2, host: \"${MONGO_DB_HOST3}\"}
    ]
})
"

docker rm mongo-key-generator
