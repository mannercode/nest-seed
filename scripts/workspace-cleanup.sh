#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/common.cfg"

docker rm -f $(docker ps -aq)
docker system prune -af
docker volume prune -af

rm -rf $PROJECT_ROOT/node_modules

# TODO log나 upload 같은 폴더 제거하면 sudo가 필요 없다.
 rm -rf $PROJECT_ROOT/_output
