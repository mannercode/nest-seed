#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
workspace_root="${WORKSPACE_ROOT:-$(cd "${script_dir}/../.." && pwd)}"
diagnostics_directory="${workspace_root}/_output/ci-diagnostics"
command_to_run=("$@")

on_failure() {
    local exit_code=$?

    trap - ERR
    set +e
    mkdir -p "${diagnostics_directory}"
    {
        printf 'captured_at=%s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
        printf 'exit_code=%s\n' "${exit_code}"
        printf 'command='
        printf ' %q' "${command_to_run[@]}"
        printf '\n'
    } >"${diagnostics_directory}/failure.txt"

    timeout --kill-after=5s 110s bash "${script_dir}/dump-mongo-diagnostics.sh" 2>&1 |
        tee "${diagnostics_directory}/mongo.txt"
    local diagnostics_exit=${PIPESTATUS[0]}
    if [ "${diagnostics_exit}" -ne 0 ]; then
        echo "MongoDB diagnostics timed out or failed" |
            tee -a "${diagnostics_directory}/mongo.txt"
    fi
    exit "${exit_code}"
}
trap on_failure ERR

"$@"
