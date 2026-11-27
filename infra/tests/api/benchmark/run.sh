#!/bin/bash
set -Eeuo pipefail
cd -- "$(dirname -- "$0")"

SERVER_URL="http://nginx"
OUTPUT_DIR="_output/$(date '+%Y%m%d-%H%M%S')"
HTML_REPORT="${OUTPUT_DIR}/report.html"
JSON_SUMMARY="${OUTPUT_DIR}/summary.json"

mkdir -p _output
mkdir "${OUTPUT_DIR}"

dirty=false
commit=$(git rev-parse HEAD)
changes=$(git status --porcelain)
if [[ -n "$changes" ]]; then dirty=true; fi
engine=$(docker info --format '{{.OSType}}/{{.Architecture}} {{.NCPU}} CPUs {{.MemTotal}} bytes, Docker {{.ServerVersion}}')
containers=$(docker compose ps -q)
if [[ -z "$containers" ]]; then echo 'No running benchmark services' >&2; exit 1; fi
images=$(xargs docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}} {{.Image}}' <<< "$containers" | sort)
k6_image=$(docker compose config --images k6)

k6_arguments=(
    run
    --env "SERVER_URL=${SERVER_URL}"
    --env "SUMMARY_PATH=${JSON_SUMMARY}"
    --env "BENCHMARK_COMMIT=${commit}"
    --env "BENCHMARK_DIRTY=${dirty}"
    --env "BENCHMARK_ENGINE=${engine}"
    --env "BENCHMARK_IMAGES=${images}"
    --env "BENCHMARK_K6_IMAGE=${k6_image}"
)
[[ -n "${DURATION_MS:-}" ]] && k6_arguments+=(--env "DURATION_MS=${DURATION_MS}")
[[ -n "${WARMUP_MS:-}" ]] && k6_arguments+=(--env "WARMUP_MS=${WARMUP_MS}")
k6_arguments+=(crud.js)

docker compose run --rm --no-deps --no-TTY \
    --workdir "$PWD" --user "$(id -u):$(id -g)" \
    --env K6_WEB_DASHBOARD=true --env K6_WEB_DASHBOARD_PORT=-1 \
    --env K6_WEB_DASHBOARD_PERIOD=2s --env "K6_WEB_DASHBOARD_EXPORT=${HTML_REPORT}" \
    k6 "${k6_arguments[@]}"

echo "HTML: ${PWD}/${HTML_REPORT}"
echo "JSON: ${PWD}/${JSON_SUMMARY}"
