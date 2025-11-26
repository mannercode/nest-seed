#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
. ./common.cfg

. $PROJECT_ROOT/.env
HOST="http://host.docker.internal:${HTTP_PORT}"

tests=(auth customers)

for test in "${tests[@]}"; do
    reset_all
    create_user_and_login

    . "./${test}.spec"
done

print_result
