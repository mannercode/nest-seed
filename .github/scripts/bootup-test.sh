#!/usr/bin/env bash
set -Eeuo pipefail

bash .devcontainer/infra/reset.sh
npm run test:unit
