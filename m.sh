#!/bin/bash
set -euo pipefail

HOST=localhost:9000
CONTAINER_NAME=s3
CONSOLE_PORT=9001
AWS_ACCESS_KEY_ID=admin
AWS_SECRET_ACCESS_KEY=password


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
