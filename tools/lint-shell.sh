#!/bin/bash
set -euo pipefail

cd "${WORKSPACE_ROOT:?}"
git ls-files -z -- '*.sh' '.husky/*' | xargs -0 shellcheck --severity=warning -x
