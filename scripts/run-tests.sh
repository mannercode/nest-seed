#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/common.cfg"

TEST_SUITES=("src" "src/apps" "src/libs/common")

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

	# npx jest /workspaces/nest-msa/src/libs/common/mongoose/__tests__/mongoose.repository.spec.ts \
	# 	-c '/workspaces/nest-msa/jest.config.ts' -t 'MongooseRepository'

	npx jest --no-cache --coverage \
		--config "$PROJECT_ROOT/jest.config.ts" \
		--roots "<rootDir>/$TEST_SUITE" \
		--collectCoverageFrom "$TEST_SUITE/**/*.ts"
done

echo "Done. $TEST_RUNS run(s) finished."
