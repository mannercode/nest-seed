#!/bin/bash
set -euo pipefail

HOST=localhost:9000
CONTAINER_NAME=s3
CONSOLE_PORT=9001
AWS_ACCESS_KEY_ID=admin
AWS_SECRET_ACCESS_KEY=password

# docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
# docker run -d --name "${CONTAINER_NAME}" \
#     -p 9000:9000 -p 9001:9001 \
#     -e MINIO_ROOT_USER="${AWS_ACCESS_KEY_ID}" \
#     -e MINIO_ROOT_PASSWORD="${AWS_SECRET_ACCESS_KEY}" \
#     -e MINIO_BROWSER_REDIRECT_URL="http://localhost:${CONSOLE_PORT}" \
#     minio/minio server /data --console-address ":${CONSOLE_PORT}" >/dev/null

# # ===== MinIO ready 대기 =====
# for i in {1..30}; do
#     if curl -fsS "http://${HOST}/minio/health/ready" >/dev/null; then
#         echo "MinIO is ready"
#         break
#     fi
#     sleep 1
#     [[ $i -eq 30 ]] && {
#         echo "MinIO not ready" >&2
#         exit 1
#     }
# done


aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID
aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY

FILE_PATH="/tmp/한글.txt"
dd if=/dev/zero bs=5000000 count=1 | tr '\0' 'a' >$FILE_PATH

echo "To make a bucket"
aws --endpoint-url http://$HOST s3 mb s3://mybucket
echo "To list your buckets"
aws --endpoint-url http://$HOST s3 ls
echo "To add an object to a bucket"
aws --endpoint-url http://$HOST s3 cp $FILE_PATH s3://mybucket
echo "To list contents inside bucket"
aws --endpoint-url http://$HOST s3 ls s3://mybucket
echo "To delete an object from a bucket"
aws --endpoint-url http://$HOST s3 rm s3://mybucket/$(basename $FILE_PATH)
echo "after remove object"
aws --endpoint-url http://$HOST s3 ls s3://mybucket
echo "To remove a bucket"
aws --endpoint-url http://$HOST s3 rb s3://mybucket
echo "after remove bucket"
aws --endpoint-url http://$HOST s3 ls
echo ""
rm $FILE_PATH
