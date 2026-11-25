#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")/api-docs"
exec tar --exclude=./_output --exclude=./test.sh -czf - .
