#!/bin/sh
# `temporalio/server` 이미지는 namespace를 자동 생성하지 않는다.
# 서버가 준비된 뒤 admin-tools에서 default namespace를 한 번 등록해, 이후 워커와 클라이언트가 같은 namespace로 연결되도록 한다.
set -eu

# 두 값은 compose.temporal.yml의 environment가 넘긴다. 배선이 빠지면 엉뚱한 namespace를 만들지 말고 즉시 실패한다.
NAMESPACE=${DEFAULT_NAMESPACE:?}
TEMPORAL_ADDRESS=${TEMPORAL_ADDRESS:?}
MAX_ATTEMPTS=30
SLEEP_SECONDS=5

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

# dev/test에서 완료 워크플로가 누적돼 transfer-queue를 정체시키지 않도록 1h로 짧게 잡는다.
# Temporal 디폴트(72h)는 운영용.
# minRetentionDays=0이 dynamic config로 풀려 있어야 1h 설정이 허용된다.
NAMESPACE_RETENTION=1h0m0s

echo "Server is healthy, creating namespace '$NAMESPACE' (retention=$NAMESPACE_RETENTION)..."
attempt=1
while :; do
    if temporal operator namespace describe -n "$NAMESPACE" --address "$TEMPORAL_ADDRESS" >/dev/null 2>&1; then
        echo "Namespace '$NAMESPACE' already exists"
        break
    fi
    if temporal operator namespace create -n "$NAMESPACE" --retention "$NAMESPACE_RETENTION" --address "$TEMPORAL_ADDRESS" >/dev/null 2>&1; then
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
