#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
. ./.env

C_RESET='\033[0m'
C_BOLD='\033[1m'
C_BRIGHT_BLACK='\033[90m'
C_GREEN='\033[32m'
C_BRIGHT_CYAN='\033[96m'

prompt_selection() {
	local options=("$@")
	local current=0
	while true; do
		for i in "${!options[@]}"; do
			if [ "${i}" -eq "${current}" ]; then
				printf '%b%s%b\n' "${C_BOLD}> ${C_GREEN}" "${options[${i}]}" "${C_RESET}" >&2
			else
				printf '%b%s%b\n' "${C_BRIGHT_BLACK}  " "${options[${i}]}" "${C_RESET}" >&2
			fi
		done >&2

		read -rsn1 key
		case "${key}" in
		$'\x1b')
			read -rsn2 -t 1 key
			case "${key}" in
			'[A') ((current > 0)) && ((current -= 1)) || true ;;
			'[B') (( current < ${#options[@]} - 1 )) && (( current++ )) || true ;;
			esac
			;;
		'') break ;;
		esac
		tput cuu "${#options[@]}" >&2
	done

	printf '%s\n' "${options[${current}]}"
}

mapfile -d '' -t all_specs < <(find ./specs -type f -name '*.spec' -print0 | sort -z)

ROUTES=()
for spec in "${all_specs[@]}"; do
	route="/${spec#./specs/}"
	route="${route%.spec}"
	ROUTES+=("${route}")
done

printf '\n%b%s%b\n' "${C_BOLD}${C_BRIGHT_CYAN}" "Select e2e path:" "${C_RESET}"
SELECTED_ROUTE=$(prompt_selection "all" "${ROUTES[@]}")

npm run infra:reset
npm run apps:reset
trap 'npm run apps:down' EXIT

if [[ "${SELECTED_ROUTE}" == "all" ]]; then
	bash ./run.sh
else
	bash ./run.sh "./specs/${SELECTED_ROUTE#/}.spec"
fi
