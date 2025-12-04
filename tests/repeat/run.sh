#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/utils.cfg"

TEST_SUITES=("src" "apps" "common")

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

for ((i = 1; i <= TEST_RUNS; i++)); do
	echo "[Run $i/$TEST_RUNS]"
	npm run test:${TEST_SUITE}
done

echo "Done. $TEST_RUNS run(s) finished."
