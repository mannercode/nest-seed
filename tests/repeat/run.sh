#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/utils.cfg"

TEST_SUITES=("src" "src/apps" "src/libs/common")

if [ $# -ge 1 ]; then
	TEST_SUITE="$1"
	TEST_RUNS="${2:-1}"
else
	echo
	echo "Select test suite:"

	TEST_SUITE=$(prompt_selection "${TEST_SUITES[@]}")

	read -p "Enter number of runs (default 500): " TEST_RUNS
	TEST_RUNS=${TEST_RUNS:-500}
fi

export TEST_ROOT=${TEST_SUITE}

for ((i = 1; i <= TEST_RUNS; i++)); do
	echo "[Run $i/$TEST_RUNS]"
	npm test
done

echo "Done. $TEST_RUNS run(s) finished."
