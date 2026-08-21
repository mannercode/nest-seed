#!/bin/bash

is_valid_tunnel_port() {
	local value=$1

	[[ "${value}" =~ ^[0-9]+$ ]] && ((10#${value} >= 1 && 10#${value} <= 65535))
}

validate_tunnel_policy() {
	local port_name
	local port_value
	local api_port
	local console_port
	local user_app_port

	if [[ "${TUNNEL_EXPOSE_API:-false}" == 'true' ]]; then
		printf '%s\n' \
			'Refusing to start: direct API Quick Tunnel is disabled.' \
			'The tunnel process cannot prove which secrets the already-running API process uses.' >&2
		return 1
	fi

	if [[ "${TUNNEL_EXPOSE_APPS:-false}" != 'true' ]]; then
		printf '%s\n' \
			'Refusing to create public tunnels without an explicit opt-in.' \
			'Set TUNNEL_EXPOSE_APPS=true to expose console/user-app.' >&2
		return 1
	fi

	if [[ "${TUNNEL_ACKNOWLEDGE_PUBLIC_DEV_STACK_RISK:-false}" != 'true' ]]; then
		printf '%s\n' \
			'Refusing to expose the app servers without an explicit risk acknowledgement.' \
			'The catch-all app BFFs proxy most API routes, so this exposes the development API surface too.' \
			'Set TUNNEL_ACKNOWLEDGE_PUBLIC_DEV_STACK_RISK=true only for an isolated disposable environment.' >&2
		return 1
	fi

	for port_name in API_PORT CONSOLE_PORT USER_APP_PORT; do
		port_value=${!port_name:-}
		if ! is_valid_tunnel_port "${port_value}"; then
			printf 'Refusing to start: %s must be a valid TCP port (1-65535).\n' "${port_name}" >&2
			return 1
		fi
	done

	api_port=$((10#${API_PORT}))
	console_port=$((10#${CONSOLE_PORT}))
	user_app_port=$((10#${USER_APP_PORT}))
	if ((api_port == console_port || api_port == user_app_port || console_port == user_app_port)); then
		printf '%s\n' \
			'Refusing to start: API_PORT, CONSOLE_PORT, and USER_APP_PORT must be distinct.' \
			'An app tunnel must never alias the direct API listener.' >&2
		return 1
	fi
}
