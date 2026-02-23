#!/usr/bin/env bash
set -euo pipefail

API_BASE="${SMOKE_API_BASE:-http://localhost:3100}"
SIGNING_SECRET="${SMOKE_SIGNING_SECRET:-}"
if [ -z "$SIGNING_SECRET" ]; then
  echo "[smoke-auth-matrix] FAIL: SMOKE_SIGNING_SECRET is required"
  echo "[smoke-auth-matrix] hint: SMOKE_SIGNING_SECRET='<JWT secret>' npm run smoke:auth:matrix"
  exit 1
fi

echo "[smoke-auth-matrix] check backend reachable"
curl -fsS "$API_BASE/api/v1/health" >/tmp/smoke-auth-matrix-health.json

for role in admin teacher viewer; do
  echo "[smoke-auth-matrix] run role=$role"
  SMOKE_GENERATE_TOKEN_ROLE="$role" \
  SMOKE_EXPECTED_ROLE="$role" \
  SMOKE_SIGNING_SECRET="$SIGNING_SECRET" \
  SMOKE_API_BASE="$API_BASE" \
  SMOKE_TOKEN_ISSUER="${SMOKE_TOKEN_ISSUER:-}" \
  SMOKE_TOKEN_AUDIENCE="${SMOKE_TOKEN_AUDIENCE:-}" \
  bash scripts/smoke-auth.sh
done

echo "[smoke-auth-matrix] DONE"
