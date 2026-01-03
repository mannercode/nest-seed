#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/utils.cfg"

TEST_ROOTS=("src" "src/apps" "src/libs/common")

if [ $# -ge 1 ]; then
	TEST_ROOT="$1"
	TEST_RUNS="${2:-1}"
else
	echo
	echo "Select test suite:"

	TEST_ROOT=$(prompt_selection "${TEST_ROOTS[@]}")

	read -p "Enter number of runs (default 500): " TEST_RUNS
	TEST_RUNS=${TEST_RUNS:-500}
fi

export TEST_ROOT=${TEST_ROOT}

for ((i = 1; i <= TEST_RUNS; i++)); do
	echo "[Run ${i}/${TEST_RUNS}]"
	npm test
done

echo "Done. ${TEST_RUNS} run(s) finished."
