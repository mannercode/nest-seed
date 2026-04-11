#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE="${ENV_FILE:-../.env}"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found."
    exit 1
fi

CLIENTS=${CLIENTS:-20}
ROUNDS=${ROUNDS:-10}
LISTEN_PORT=${LISTEN_PORT:-3000}
SERVER_URL="http://localhost:${LISTEN_PORT}"
API_SPEC_DIR="${SCRIPT_DIR}/api"
LOG_DIR="${SCRIPT_DIR}/_output/logs/$(date '+%Y%m%d_%H%M%S')"

RESET='\033[0m'
BOLD='\033[1m'
GREEN='\033[32m'
RED='\033[31m'
CYAN='\033[36m'

cleanup() {
    echo ""
    echo "Tearing down..."
    docker compose --env-file "$ENV_FILE" down -v -t 0
}
trap cleanup EXIT

echo "Building and deploying mono app..."
REPLICAS=${REPLICAS:-4} docker compose --env-file "$ENV_FILE" up --build -d
docker compose --env-file "$ENV_FILE" up --wait

echo ""
docker compose --env-file "$ENV_FILE" ps

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
