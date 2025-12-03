#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

PROJECT_ROOT=$WORKSPACE_ROOT

OPTIONS=(
	--env-file "$PROJECT_ROOT/.env"
	--env-file "$PROJECT_ROOT/.env.infra"
)

docker compose "${OPTIONS[@]}" down --remove-orphans --volumes --timeout 0
docker compose "${OPTIONS[@]}" up -d

docker wait infras-setup && docker rm infras-setup
