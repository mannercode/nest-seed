#!/bin/bash
set -euo pipefail
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

# aws s3 cli examples
#
# ENDPOINT=http://localhost:9000
# AWS_ACCESS_KEY_ID=admin
# AWS_SECRET_ACCESS_KEY=password


# aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID
# aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY

# FILE_PATH="/tmp/한글.txt"
# dd if=/dev/zero bs=5000000 count=1 | tr '\0' 'a' >$FILE_PATH

# echo "To make a bucket"
# aws --endpoint-url $ENDPOINT s3 mb s3://mybucket
# echo "To list your buckets"
# aws --endpoint-url $ENDPOINT s3 ls
# echo "To add an object to a bucket"
# aws --endpoint-url $ENDPOINT s3 cp $FILE_PATH s3://mybucket
# echo "To list contents inside bucket"
# aws --endpoint-url $ENDPOINT s3 ls s3://mybucket
# echo "To delete an object from a bucket"
# aws --endpoint-url $ENDPOINT s3 rm s3://mybucket/$(basename $FILE_PATH)
# echo "after remove object"
# aws --endpoint-url $ENDPOINT s3 ls s3://mybucket
# echo "To remove a bucket"
# aws --endpoint-url $ENDPOINT s3 rb s3://mybucket
# echo "after remove bucket"
# aws --endpoint-url $ENDPOINT s3 ls
# echo ""
# rm $FILE_PATH
