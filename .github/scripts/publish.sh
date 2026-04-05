#!/usr/bin/env bash
set -Eeuo pipefail

npx turbo run build && npx changeset publish
