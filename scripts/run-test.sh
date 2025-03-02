#!/bin/bash
set -e
. "$(dirname "$0")/common.cfg"

TEST_OPTIONS=("all" "apps" "common")

if [ $# -ge 2 ]; then
    TEST_SUITE="$1"
    TEST_RUNS="$2"
else
    echo -e "\nSelect Test Target (↑↓ to navigate, Enter to select)"

    TEST_SUITE=$(prompt_selection "${TEST_OPTIONS[@]}")

    read -p "Enter number of runs (default 1): " runs
    TEST_RUNS=${TEST_RUNS:-1}
fi

if [ "$TEST_SUITE" == "common" ]; then
    EXTRA_OPTIONS=(
        --roots "<rootDir>/src/libs/common"
        --collectCoverageFrom "src/libs/common/**/*.ts"
    )
elif [ "$TEST_SUITE" == "apps" ]; then
    EXTRA_OPTIONS=(
        --roots "<rootDir>/src/apps"
        --collectCoverageFrom "src/apps/**/*.ts"
    )
else
    EXTRA_OPTIONS=()
fi

for ((i = 1; i <= TEST_RUNS; i++)); do
    echo "[Run #$i/$TEST_RUNS]"
    bash $WORKSPACE_ROOT/scripts/reset-infra.sh

    npx jest --no-cache --coverage --config "$WORKSPACE_ROOT/jest.config.ts" "${EXTRA_OPTIONS[@]}"
done

echo "All $TEST_RUNS test runs completed successfully"
