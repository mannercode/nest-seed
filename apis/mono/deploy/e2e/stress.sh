#!/bin/bash
set -Eeuo pipefail
cd "$(dirname "$0")"

SCRIPT_DIR="$(pwd)"
API_SPEC_DIR="../../docs/api"
CLIENTS=${CLIENTS:-10}
ROUNDS=${ROUNDS:-3}
SERVER_URL=${SERVER_URL:-http://localhost:3000}
LOG_DIR="${SCRIPT_DIR}/_output/logs/$(date '+%Y%m%d_%H%M%S')"

RESET='\033[0m'
BOLD='\033[1m'
GREEN='\033[32m'
RED='\033[31m'
CYAN='\033[36m'

mkdir -p "${LOG_DIR}"

echo ""
echo -e "${BOLD}Stress Test${RESET}"
echo -e "  server  : ${CYAN}${SERVER_URL}${RESET}"
echo -e "  clients : ${CYAN}${CLIENTS}${RESET}"
echo -e "  rounds  : ${CYAN}${ROUNDS}${RESET}"
echo ""

run_client() {
    local client_id=$1
    local round=$2
    local log_file="${LOG_DIR}/client_${client_id}_round_${round}.log"

    SERVER_URL="${SERVER_URL}" bash "${API_SPEC_DIR}/run-all.sh" >"${log_file}" 2>&1
    return $?
}

TOTAL=0
PASSED=0
FAILED=0

for ((round = 1; round <= ROUNDS; round++)); do
    echo -e "${BOLD}Round ${round}/${ROUNDS}${RESET}"

    pids=()
    for ((client = 1; client <= CLIENTS; client++)); do
        run_client "${client}" "${round}" &
        pids+=($!)
    done

    for i in "${!pids[@]}"; do
        client=$((i + 1))
        TOTAL=$((TOTAL + 1))

        if wait "${pids[$i]}"; then
            PASSED=$((PASSED + 1))
            echo -e "  ${GREEN}[PASS]${RESET} client ${client}"
        else
            FAILED=$((FAILED + 1))
            echo -e "  ${RED}[FAIL]${RESET} client ${client} (see ${LOG_DIR}/client_${client}_round_${round}.log)"
        fi
    done

    echo ""
done

echo -e "${BOLD}Results${RESET}"
echo -e "  total  : ${TOTAL}"
echo -e "  passed : ${GREEN}${PASSED}${RESET}"
echo -e "  failed : ${RED}${FAILED}${RESET}"
echo -e "  logs   : ${CYAN}${LOG_DIR}${RESET}"

if [[ "${FAILED}" -gt 0 ]]; then
    exit 1
fi
