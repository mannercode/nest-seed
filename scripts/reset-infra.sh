#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
. "./common.cfg"

OPTIONS=(
	-f "infras/compose.yml"
	--env-file "$PROJECT_ROOT/.env"
	--env-file "$PROJECT_ROOT/.env.infra"
)

docker compose "${OPTIONS[@]}" down --remove-orphans --volumes --timeout 0
docker compose "${OPTIONS[@]}" up -d

docker wait infras-setup && docker rm infras-setup
