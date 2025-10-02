#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/common.cfg"

docker_compose --profile apps --profile infra down --rmi all

rm -rf $PROJECT_ROOT/_output
rm -rf $PROJECT_ROOT/node_modules
