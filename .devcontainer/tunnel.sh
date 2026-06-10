#!/bin/bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."

# 개발 중 공개 https 도메인이 필요할 때 쓰는 quick tunnel.
# api(백엔드)·console·user-app(프론트) 세 서비스를 각각 임시 URL로 노출한다.
# 대상은 아래 name:port 목록으로만 정해지니, 줄을 빼거나 더하면 그대로 반영된다.
# 포트의 정의처는 .env.infra(API_PORT·CONSOLE_PORT·USER_APP_PORT)다.
TARGETS=("api:${API_PORT:?}" "console:${CONSOLE_PORT:?}" "user-app:${USER_APP_PORT:?}")

# 발급된 공개 URL 목록을 루트 파일로 떨궈 둔다(.gitignore 대상). 매 실행마다 값이 바뀐다.
URL_FILE=".tunnel-url"
PID_FILE="/tmp/cloudflared.pid"
LOG_DIR="/tmp/cloudflared"

# 이 스크립트를 다시 돌리면(컨테이너 재시작·수동 재실행) 이전 터널들이 살아 URL이 어긋난다.
# PID 파일에 적어둔 게 아직 우리 cloudflared가 맞을 때만(/proc로 확인) 그 인스턴스들을 정리한다.
if [[ -f "$PID_FILE" ]]; then
	while read -r oldpid; do
		grep -qaz cloudflared "/proc/${oldpid}/cmdline" 2>/dev/null && kill "$oldpid" 2>/dev/null || true
	done <"$PID_FILE"
fi

mkdir -p "$LOG_DIR"
: >"$URL_FILE"
: >"$PID_FILE"

# 세 터널을 동시에 띄운다(로그는 서비스별로 분리).
for t in "${TARGETS[@]}"; do
	name=${t%:*}
	port=${t#*:}
	cloudflared tunnel --url "http://localhost:${port}" >"${LOG_DIR}/${name}.log" 2>&1 &
	echo $! >>"$PID_FILE"
done

# 엣지 연결이 끝나면 각 로그에 *.trycloudflare.com URL이 한 줄 뜬다. 서비스별로 기다렸다 포트와 함께 적는다.
for t in "${TARGETS[@]}"; do
	name=${t%:*}
	port=${t#*:}
	log="${LOG_DIR}/${name}.log"
	url=""
	for _ in $(seq 1 30); do
		url=$(grep -aoE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$log" | head -1 || true)
		[[ -n "$url" ]] && break
		sleep 1
	done
	if [[ -n "$url" ]]; then
		printf '%-9s http://localhost:%s -> %s\n' "$name" "$port" "$url" >>"$URL_FILE"
	else
		printf '%-9s http://localhost:%s -> (실패: %s 확인)\n' "$name" "$port" "$log" >>"$URL_FILE"
	fi
done

cat "$URL_FILE"
