#!/bin/sh
# `temporalio/server` 이미지는 PostgreSQL 스키마를 준비하지 않습니다. 첫 부팅 때
# admin-tools에서 `temporal`과 `temporal_visibility` 스키마를 적용합니다.
# `create` 단계는 이미 존재하는 DB에서 실패할 수 있으므로 무시하고, versioned
# schema update는 매번 실행해 필요한 migration을 반영합니다.
set -eu

: "${POSTGRES_SEEDS:?ERROR: POSTGRES_SEEDS environment variable is required}"
: "${POSTGRES_USER:?ERROR: POSTGRES_USER environment variable is required}"

echo 'Starting PostgreSQL schema setup...'
echo 'Waiting for PostgreSQL port to be available...'
nc -z -w 10 ${POSTGRES_SEEDS} ${DB_PORT:-5432}
echo 'PostgreSQL port is available'

# temporal DB
temporal-sql-tool --plugin postgres12 --ep ${POSTGRES_SEEDS} -u ${POSTGRES_USER} -p ${DB_PORT:-5432} --db temporal create || true
temporal-sql-tool --plugin postgres12 --ep ${POSTGRES_SEEDS} -u ${POSTGRES_USER} -p ${DB_PORT:-5432} --db temporal setup-schema -v 0.0 || true
temporal-sql-tool --plugin postgres12 --ep ${POSTGRES_SEEDS} -u ${POSTGRES_USER} -p ${DB_PORT:-5432} --db temporal update-schema -d /etc/temporal/schema/postgresql/v12/temporal/versioned

# visibility DB
temporal-sql-tool --plugin postgres12 --ep ${POSTGRES_SEEDS} -u ${POSTGRES_USER} -p ${DB_PORT:-5432} --db temporal_visibility create || true
temporal-sql-tool --plugin postgres12 --ep ${POSTGRES_SEEDS} -u ${POSTGRES_USER} -p ${DB_PORT:-5432} --db temporal_visibility setup-schema -v 0.0 || true
temporal-sql-tool --plugin postgres12 --ep ${POSTGRES_SEEDS} -u ${POSTGRES_USER} -p ${DB_PORT:-5432} --db temporal_visibility update-schema -d /etc/temporal/schema/postgresql/v12/visibility/versioned

echo 'PostgreSQL schema setup complete'
