#!/usr/bin/env bash
set -Eeuo pipefail

# CI 도 dev 와 동일한 reset 경로를 쓴다 — daemon-wide 명령 (rm -f $(ps -aq),
# volume prune -af) 은 reset.sh 가 compose-scoped 로 대체했다.
bash .devcontainer/infra/reset.sh

npm test -w apps
