#!/bin/bash
set -e
cd "$(dirname "$0")"
. ./common.cfg

ERROR_LOG=""

. ./auth.test
. ./customers.test

if [[ -z "$ERROR_LOG" ]]; then
    echo "Test Successful"
else
    echo "List of Failed Tests:"
    echo -e "$ERROR_LOG"
    exit 1
fi
