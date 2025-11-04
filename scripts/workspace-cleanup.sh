#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/common.cfg"

docker_compose --profile apps --profile infra down --rmi all

# TODO log나 upload 같은 폴더 제거하면 sudo가 필요 없다.
sudo rm -rf $PROJECT_ROOT/_output
rm -rf $PROJECT_ROOT/node_modules
