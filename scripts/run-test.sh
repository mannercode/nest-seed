#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/common.cfg"

TEST_SUITES=("all" "apps" "common" "e2e")

if [ $# -ge 1 ]; then
	TEST_SUITE="$1"
	TEST_RUNS="${2:-1}"
else
	echo
	echo "Select test suite:"

	TEST_SUITE=$(prompt_selection "${TEST_SUITES[@]}")

	read -p "Enter number of runs (default 1): " TEST_RUNS
	TEST_RUNS=${TEST_RUNS:-1}
fi

jest_command() {
	local dir="$1"
	COMMAND=(
		npx jest --no-cache --coverage --config "$PROJECT_ROOT/jest.config.ts"
		--roots "<rootDir>/$dir"
		--collectCoverageFrom "$dir/**/*.ts"
	)
}

if [ "$TEST_SUITE" == "common" ]; then
	jest_command "src/libs/common"
elif [ "$TEST_SUITE" == "apps" ]; then
	jest_command "src/apps"
elif [ "$TEST_SUITE" == "all" ]; then
	jest_command "src"
elif [ "$TEST_SUITE" == "e2e" ]; then
	COMMAND=(bash "$PROJECT_ROOT/test/e2e/run.sh")
else
	echo "Unknown test suite: $TEST_SUITE" >&2
	exit 1
fi

for ((i = 1; i <= TEST_RUNS; i++)); do
	echo "[Run $i/$TEST_RUNS]"
	"${COMMAND[@]}"
done

echo "Done. $TEST_RUNS run(s) finished."
