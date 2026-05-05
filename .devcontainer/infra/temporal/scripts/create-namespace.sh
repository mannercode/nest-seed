#!/bin/sh
# temporal server up 후 default namespace 생성. server only image 는 자동
# namespace bootstrap 안 함 (auto-setup 이 하던 일). one-shot service.
#
# samples-server 의 원본 스크립트에 MAX_ATTdMPTS typo 가 있어서 수정함.
set -eu

NAMESPACE=${DEFAULT_NAMESPACE:-default}
TEMPORAL_ADDRESS=${TEMPORAL_ADDRESS:-temporal:7233}
MAX_ATTEMPTS=${TEMPORAL_HEALTH_CHECK_MAX_ATTEMPTS:-30}
SLEEP_SECONDS=${TEMPORAL_HEALTH_CHECK_SLEEP_SECONDS:-5}

echo "Waiting for Temporal server port to be available..."
SERVER_HOST=$(echo "$TEMPORAL_ADDRESS" | cut -d: -f1)
SERVER_PORT=$(echo "$TEMPORAL_ADDRESS" | cut -d: -f2)
attempt=1
while ! nc -z -w 10 "$SERVER_HOST" "$SERVER_PORT"; do
    if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
        echo "Temporal server port did not become available after $MAX_ATTEMPTS attempts"
        exit 1
    fi
    echo "Temporal server port not ready yet, waiting... (attempt $attempt/$MAX_ATTEMPTS)"
    attempt=$((attempt + 1))
    sleep "$SLEEP_SECONDS"
done
echo 'Temporal server port is available'

echo 'Waiting for Temporal server to be healthy...'
attempt=1
while :; do
    if temporal operator cluster health --address "$TEMPORAL_ADDRESS"; then
        break
    fi
    if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
        echo "Server did not become healthy after $MAX_ATTEMPTS attempts"
        exit 1
    fi
    echo "Server not ready yet, waiting... (attempt $attempt/$MAX_ATTEMPTS)"
    attempt=$((attempt + 1))
    sleep "$SLEEP_SECONDS"
done

echo "Server is healthy, creating namespace '$NAMESPACE'..."
attempt=1
while :; do
    if temporal operator namespace describe -n "$NAMESPACE" --address "$TEMPORAL_ADDRESS" >/dev/null 2>&1; then
        echo "Namespace '$NAMESPACE' already exists"
        break
    fi
    # 1h retention so completed workflow histories get GC'd quickly under
    # sustained test load. minRetentionDays=0 dynamic config required.
    if temporal operator namespace create -n "$NAMESPACE" --retention 1h --address "$TEMPORAL_ADDRESS" >/dev/null 2>&1; then
        echo "Namespace '$NAMESPACE' created"
        break
    fi
    if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
        echo "Failed to create namespace '$NAMESPACE' after $MAX_ATTEMPTS attempts"
        exit 1
    fi
    echo "Namespace operation not ready yet, waiting... (attempt $attempt/$MAX_ATTEMPTS)"
    attempt=$((attempt + 1))
    sleep "$SLEEP_SECONDS"
done
