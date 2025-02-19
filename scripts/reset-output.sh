#!/bin/bash
set -e
. "$(dirname "$0")/common.cfg"
. $TEST_ENV_FILE

rm -rf $WORKSPACE_ROOT/_output
mkdir -p $WORKSPACE_ROOT/$LOG_DIRECTORY
mkdir -p $WORKSPACE_ROOT/$FILE_UPLOAD_DIRECTORY
