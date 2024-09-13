#!/bin/bash
set -e
. "$(dirname "$0")"/common.cfg
. $ENV_FILE

bash $SCRIPTS_PATH/run_infra.sh
bash $SCRIPTS_PATH/reset_output.sh

npm ci --prefix $WORKSPACE_ROOT
