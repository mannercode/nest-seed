#!/usr/bin/env bash
set -Eeuo pipefail

# CI 도 개발 환경과 같은 reset 경로를 쓴다. 호스트 docker 전체에 영향을 주는
# 명령은 쓰지 않는다. 같은 일을 `reset.sh` 가 compose 단위 안에서 처리한다.
bash .devcontainer/infra/reset.sh

npm test -w apps
