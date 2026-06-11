#!/bin/bash
set -Eeuo pipefail

# cloudflared의 장황한 출력은 /tmp/tunnel.log로 보내고, 배너에서 발급 주소만 뽑아 보여준다.
tunnel() {
	cloudflared tunnel --url "http://localhost:$2" 2>&1 |
		tee -a /tmp/tunnel.log |
		grep --line-buffered -oE 'https://[a-z0-9-]+\.trycloudflare\.com' |
		sed -u "s|^|$1 -> |" &
}

tunnel api "${API_PORT}"
tunnel console "${CONSOLE_PORT}"
tunnel user-app "${USER_APP_PORT}"
wait
