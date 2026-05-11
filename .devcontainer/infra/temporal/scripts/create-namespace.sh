#!/bin/sh
# Temporal 서버가 뜬 뒤 default namespace 를 만든다. auto-setup 이미지는
# 이 작업을 자동으로 해 줬지만, 서버 전용 이미지는 그렇지 않아 admin-tools
# 로 한 번 만든다. 한 번만 돌면 되는 one-shot 서비스다.
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
    if temporal operator namespace create -n "$NAMESPACE" --address "$TEMPORAL_ADDRESS" >/dev/null 2>&1; then
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
