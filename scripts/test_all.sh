#!/bin/bash
set -e
. "$(dirname "$0")"/common.cfg

npm run test:all --prefix $WORKSPACE_ROOT

npm run build --prefix $WORKSPACE_ROOT

bash test/e2e/run.sh
