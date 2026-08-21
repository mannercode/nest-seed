#!/bin/bash
set -Eeuo pipefail

SCRIPT_PATH=$(readlink -f "${BASH_SOURCE[0]}")
cd "$(dirname "${SCRIPT_PATH}")"
# shellcheck source=tunnel-policy.sh
. ./tunnel-policy.sh

TUNNEL_PIDS=()

# cloudflared의 장황한 출력은 /tmp/tunnel.log로 보내고, 배너에서 발급 주소만 뽑아 보여준다.
tunnel() {
	cloudflared tunnel --url "http://localhost:$2" > >(
		tee -a /tmp/tunnel.log |
		grep --line-buffered -oE 'https://[a-z0-9-]+\.trycloudflare\.com' |
			sed -u "s|^|$1 -> |"
	) 2>&1 &
	TUNNEL_PIDS+=("$!")
}

terminate_tunnels() {
	local pid
	for pid in "${TUNNEL_PIDS[@]}"; do
		kill "${pid}" 2>/dev/null || true
	done
	for pid in "${TUNNEL_PIDS[@]}"; do
		wait "${pid}" 2>/dev/null || true
	done
}

wait_for_tunnels() {
	local completed_pid=''
	local status
	local pid
	local -a remaining=("${TUNNEL_PIDS[@]}")
	local -a next=()

	while ((${#remaining[@]} > 0)); do
		completed_pid=''
		if wait -n -p completed_pid "${remaining[@]}"; then
			status=0
		else
			status=$?
		fi

		next=()
		for pid in "${remaining[@]}"; do
			[[ "${pid}" == "${completed_pid}" ]] || next+=("${pid}")
		done

		if ((status != 0)); then
			for pid in "${next[@]}"; do
				kill "${pid}" 2>/dev/null || true
			done
			for pid in "${next[@]}"; do
				wait "${pid}" 2>/dev/null || true
			done
			printf 'Quick Tunnel process failed (exit %d)\n' "${status}" >&2
			return "${status}"
		fi

		remaining=("${next[@]}")
	done
}

validate_tunnel_policy || exit 64
trap terminate_tunnels EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

printf '%s\n' \
	'WARNING: console/user-app are public, and their catch-all BFFs proxy most API routes.' \
	'The BFF blocks only selected auth endpoints; backend guards remain the authorization boundary.' \
	'Use only disposable data, stop the tunnels after use, and add real access control for shared environments.'
tunnel console "${CONSOLE_PORT}"
tunnel user-app "${USER_APP_PORT}"
printf '%s\n' 'direct-api -> not exposed (direct API Quick Tunnel is disabled)'

wait_for_tunnels
