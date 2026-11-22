#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"

pnpm exec vitest run --coverage "$@"
if (($# == 0)); then
    bash test-api-docs.sh
fi
