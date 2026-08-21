#!/bin/bash
set -Eeuo pipefail

cd "$(dirname "$0")"
# shellcheck source=tunnel-policy.sh
. ./tunnel-policy.sh

fail() {
	printf 'FAIL: %s\n' "$1" >&2
	exit 1
}

assert_contains() {
	local value=$1
	local expected=$2
	local description=$3

	[[ "${value}" == *"${expected}"* ]] || fail "${description}: output did not contain '${expected}'"
}

stub_dir=$(mktemp -d)
stub_pid_file="${stub_dir}/cloudflared.pids"
cleanup() {
	local child_pid
	if [[ -f "${stub_pid_file}" ]]; then
		while IFS= read -r child_pid; do
			kill "${child_pid}" 2>/dev/null || true
		done <"${stub_pid_file}"
	fi
	rm -rf -- "${stub_dir}"
}
trap cleanup EXIT
printf '%s\n' \
	'#!/bin/bash' \
	'if [[ ${CLOUDFLARED_STUB_FAIL:-false} == true ]]; then exit 23; fi' \
	'url=${3:?}' \
	'port=${url##*:}' \
	'if [[ ${CLOUDFLARED_STUB_LONG_LIVED:-false} == true ]]; then' \
	'  printf "%s\n" "$$" >>"${CLOUDFLARED_STUB_PID_FILE:?}"' \
	'  trap "exit 0" INT TERM' \
	'fi' \
	'printf "https://stub-%s.trycloudflare.com\n" "${port}"' \
	'if [[ ${CLOUDFLARED_STUB_LONG_LIVED:-false} == true ]]; then' \
	'  while true; do sleep 1; done' \
	'fi' >"${stub_dir}/cloudflared"
chmod +x "${stub_dir}/cloudflared"

ln -s "$(pwd)/tunnel.sh" "${stub_dir}/tunnel-bin"
if symlink_output=$(
	PATH="${stub_dir}:${PATH}" \
		CONSOLE_PORT=3100 \
		USER_APP_PORT=3200 \
		"${stub_dir}/tunnel-bin" 2>&1
); then
	fail 'symlinked tunnel entrypoint should enforce the opt-in policy'
fi
assert_contains "${symlink_output}" 'TUNNEL_EXPOSE_APPS=true' 'symlinked entrypoint policy'
[[ "${symlink_output}" != *'tunnel-policy.sh: No such file'* ]] || fail 'symlinked entrypoint lost its policy file'

if default_output=$(
	PATH="${stub_dir}:${PATH}" \
		API_PORT=3000 \
		CONSOLE_PORT=3100 \
		USER_APP_PORT=3200 \
		bash ./tunnel.sh 2>&1
); then
	fail 'Quick Tunnel must require an explicit exposure opt-in'
fi
assert_contains "${default_output}" 'TUNNEL_EXPOSE_APPS=true' 'default denial guidance'
[[ "${default_output}" != *'.trycloudflare.com'* ]] || fail 'a public tunnel started without opt-in'

if apps_denied_output=$(
	PATH="${stub_dir}:${PATH}" \
		API_PORT=3000 \
		CONSOLE_PORT=3100 \
		USER_APP_PORT=3200 \
		TUNNEL_EXPOSE_APPS=true \
		bash ./tunnel.sh 2>&1
); then
	fail 'app tunnels must require an explicit public-stack risk acknowledgement'
fi
assert_contains "${apps_denied_output}" 'TUNNEL_ACKNOWLEDGE_PUBLIC_DEV_STACK_RISK=true' 'app risk guidance'
[[ "${apps_denied_output}" != *'.trycloudflare.com'* ]] || fail 'an app tunnel started without risk acknowledgement'

for aliased_app in console user-app; do
	console_port=3100
	user_app_port=3200
	if [[ "${aliased_app}" == 'console' ]]; then
		console_port=3000
	else
		user_app_port=3000
	fi

	if aliased_output=$(
		PATH="${stub_dir}:${PATH}" \
			API_PORT=3000 \
			CONSOLE_PORT="${console_port}" \
			USER_APP_PORT="${user_app_port}" \
			TUNNEL_EXPOSE_APPS=true \
			TUNNEL_ACKNOWLEDGE_PUBLIC_DEV_STACK_RISK=true \
			bash ./tunnel.sh 2>&1
	); then
		fail "${aliased_app} port must not alias the direct API port"
	fi
	assert_contains "${aliased_output}" 'API_PORT, CONSOLE_PORT, and USER_APP_PORT must be distinct' "${aliased_app} API alias"
	[[ "${aliased_output}" != *'.trycloudflare.com'* ]] || fail "${aliased_app} alias started a direct API tunnel"
done

for invalid_port in 0 '3100@localhost:3000'; do
	if invalid_port_output=$(
		PATH="${stub_dir}:${PATH}" \
			API_PORT=3000 \
			CONSOLE_PORT="${invalid_port}" \
			USER_APP_PORT=3200 \
			TUNNEL_EXPOSE_APPS=true \
			TUNNEL_ACKNOWLEDGE_PUBLIC_DEV_STACK_RISK=true \
			bash ./tunnel.sh 2>&1
	); then
		fail "Quick Tunnel rejected invalid port '${invalid_port}'"
	fi
	assert_contains "${invalid_port_output}" 'valid TCP port' 'invalid tunnel port'
done

for port_tuple in '03000 3000 3200' '3000 3100 3100'; do
	read -r api_port console_port user_app_port <<<"${port_tuple}"
	if duplicate_port_output=$(
		PATH="${stub_dir}:${PATH}" \
			API_PORT="${api_port}" \
			CONSOLE_PORT="${console_port}" \
			USER_APP_PORT="${user_app_port}" \
			TUNNEL_EXPOSE_APPS=true \
			TUNNEL_ACKNOWLEDGE_PUBLIC_DEV_STACK_RISK=true \
			bash ./tunnel.sh 2>&1
	); then
		fail "Quick Tunnel accepted duplicate numeric ports '${port_tuple}'"
	fi
	assert_contains "${duplicate_port_output}" 'must be distinct' 'duplicate numeric tunnel port'
done

apps_output=$(
	PATH="${stub_dir}:${PATH}" \
		API_PORT=3000 \
		CONSOLE_PORT=3100 \
		USER_APP_PORT=3200 \
		TUNNEL_EXPOSE_APPS=true \
		TUNNEL_ACKNOWLEDGE_PUBLIC_DEV_STACK_RISK=true \
		bash ./tunnel.sh
)
assert_contains "${apps_output}" 'console -> https://stub-3100.trycloudflare.com' 'console tunnel'
assert_contains "${apps_output}" 'user-app -> https://stub-3200.trycloudflare.com' 'user-app tunnel'
assert_contains "${apps_output}" 'direct-api -> not exposed' 'direct API policy'
[[ "${apps_output}" != *'direct-api -> https://'* ]] || fail 'direct API was exposed without opt-in'

if failed_tunnel_output=$(
	PATH="${stub_dir}:${PATH}" \
		API_PORT=3000 \
		CONSOLE_PORT=3100 \
		USER_APP_PORT=3200 \
		TUNNEL_EXPOSE_APPS=true \
		TUNNEL_ACKNOWLEDGE_PUBLIC_DEV_STACK_RISK=true \
		CLOUDFLARED_STUB_FAIL=true \
		bash ./tunnel.sh 2>&1
); then
	fail 'tunnel launcher must fail when cloudflared processes fail'
fi
assert_contains "${failed_tunnel_output}" 'Quick Tunnel process failed' 'tunnel process failure'

assert_signal_cleans_children() {
	local signal=$1
	local child_pid
	local launcher_pid
	local long_lived_output="${stub_dir}/long-lived-${signal}.out"

	: >"${stub_pid_file}"
	PATH="${stub_dir}:${PATH}" \
		API_PORT=3000 \
		CONSOLE_PORT=3100 \
		USER_APP_PORT=3200 \
		TUNNEL_EXPOSE_APPS=true \
		TUNNEL_ACKNOWLEDGE_PUBLIC_DEV_STACK_RISK=true \
		CLOUDFLARED_STUB_LONG_LIVED=true \
		CLOUDFLARED_STUB_PID_FILE="${stub_pid_file}" \
		bash ./tunnel.sh >"${long_lived_output}" 2>&1 &
	launcher_pid=$!
	for _ in {1..100}; do
		[[ $(wc -l <"${stub_pid_file}") -eq 2 ]] && break
		sleep 0.02
	done
	[[ $(wc -l <"${stub_pid_file}") -eq 2 ]] || fail 'long-lived cloudflared stubs did not start'
	kill -"${signal}" "${launcher_pid}"
	if wait "${launcher_pid}"; then
		fail "${signal}-terminated tunnel launcher must report interruption"
	fi
	while IFS= read -r child_pid; do
		if kill -0 "${child_pid}" 2>/dev/null; then
			fail "cloudflared child ${child_pid} survived launcher signal ${signal}"
		fi
	done <"${stub_pid_file}"
}

assert_signal_cleans_children TERM
assert_signal_cleans_children HUP

if direct_api_output=$(
	PATH="${stub_dir}:${PATH}" \
		API_PORT=3000 \
		CONSOLE_PORT=3100 \
		USER_APP_PORT=3200 \
		TUNNEL_EXPOSE_API=true \
		TUNNEL_ACKNOWLEDGE_PUBLIC_DEV_STACK_RISK=true \
		bash ./tunnel.sh 2>&1
); then
	fail 'direct API Quick Tunnel must remain disabled'
fi
assert_contains "${direct_api_output}" 'direct API Quick Tunnel is disabled' 'direct API denial'
[[ "${direct_api_output}" != *'.trycloudflare.com'* ]] || fail 'the direct API tunnel started'

printf 'Quick Tunnel security policy PASS\n'
