#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

on_failure() {
    local exit_code=$?

    trap - ERR
    set +e
    timeout --kill-after=5s 110s bash "${script_dir}/dump-mongo-diagnostics.sh" || \
        echo "MongoDB diagnostics timed out or failed"
    exit "${exit_code}"
}
trap on_failure ERR

"$@"
