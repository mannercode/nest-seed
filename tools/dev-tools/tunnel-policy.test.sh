#!/bin/bash
set -Eeuo pipefail

cd "$(dirname "$0")"

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

assert_no_tunnel() {
    local value=$1
    local description=$2

    [[ "${value}" != *'.trycloudflare.com'* ]] || fail "${description}: a public tunnel started"
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
assert_no_tunnel "${default_output}" 'default denial'

if acknowledgement_output=$(
    PATH="${stub_dir}:${PATH}" \
        API_PORT=3000 \
        CONSOLE_PORT=3100 \
        USER_APP_PORT=3200 \
        TUNNEL_EXPOSE_APPS=true \
        bash ./tunnel.sh 2>&1
); then
    fail 'app tunnels must require an explicit public-stack risk acknowledgement'
fi
assert_contains \
    "${acknowledgement_output}" \
    'TUNNEL_ACKNOWLEDGE_PUBLIC_DEV_STACK_RISK=true' \
    'app risk guidance'
assert_no_tunnel "${acknowledgement_output}" 'missing risk acknowledgement'

if aliased_output=$(
    PATH="${stub_dir}:${PATH}" \
        API_PORT=3000 \
        CONSOLE_PORT=3000 \
        USER_APP_PORT=3200 \
        TUNNEL_EXPOSE_APPS=true \
        TUNNEL_ACKNOWLEDGE_PUBLIC_DEV_STACK_RISK=true \
        bash ./tunnel.sh 2>&1
); then
    fail 'an app tunnel must not alias the direct API port'
fi
assert_contains "${aliased_output}" 'must be distinct' 'direct API alias denial'
assert_no_tunnel "${aliased_output}" 'direct API alias denial'

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
assert_no_tunnel "${direct_api_output}" 'direct API denial'

: >"${stub_pid_file}"
PATH="${stub_dir}:${PATH}" \
    API_PORT=3000 \
    CONSOLE_PORT=3100 \
    USER_APP_PORT=3200 \
    TUNNEL_EXPOSE_APPS=true \
    TUNNEL_ACKNOWLEDGE_PUBLIC_DEV_STACK_RISK=true \
    CLOUDFLARED_STUB_LONG_LIVED=true \
    CLOUDFLARED_STUB_PID_FILE="${stub_pid_file}" \
    bash ./tunnel.sh >"${stub_dir}/long-lived.out" 2>&1 &
launcher_pid=$!
for _ in {1..100}; do
    [[ $(wc -l <"${stub_pid_file}") -eq 2 ]] && break
    sleep 0.02
done
[[ $(wc -l <"${stub_pid_file}") -eq 2 ]] || fail 'long-lived cloudflared stubs did not start'
kill -TERM "${launcher_pid}"
if wait "${launcher_pid}"; then
    fail 'TERM-terminated tunnel launcher must report interruption'
fi
while IFS= read -r child_pid; do
    if kill -0 "${child_pid}" 2>/dev/null; then
        fail "cloudflared child ${child_pid} survived launcher termination"
    fi
done <"${stub_pid_file}"

printf 'Quick Tunnel security policy PASS\n'
