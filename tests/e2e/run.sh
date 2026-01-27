#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
. ./common.cfg

. "${PROJECT_ROOT}/.env"
HOST="http://host.docker.internal:${HTTP_PORT}"

# 현재 디렉터리 및 하위 디렉터리의 모든 *.spec 파일을 수집(정렬해서 고정된 실행 순서)
mapfile -d '' -t specs < <(find . -type f -name '*.spec' -print0 | sort -z)

if ((${#specs[@]} == 0)); then
  echo "No .spec files found under $(pwd)" >&2
  exit 1
fi

for spec in "${specs[@]}"; do
  reset_all
  create_user_and_login

  . "$spec"
done

print_result

npm run apps:down
