#!/bin/bash
set -euo pipefail

if (( $# != 1 )); then
    echo '사용법: pnpm run test:api:file <API 테스트 파일 경로>' >&2
    exit 2
fi

cd -- "${WORKSPACE_ROOT:?}"
spec=$(realpath -- "$1")
if [[ "$spec" != "$PWD"/apps/api/*.spec.ts || ! -f "$spec" ]]; then
    echo "apps/api 아래의 .spec.ts 파일을 지정하세요: $1" >&2
    exit 2
fi

pnpm run build:libs
exec pnpm -C apps/api run test:vitest --coverage.enabled=false "$spec"
