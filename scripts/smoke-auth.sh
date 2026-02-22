#!/usr/bin/env bash
set -euo pipefail

API_BASE="${SMOKE_API_BASE:-http://localhost:3100}"

echo "[smoke-auth] check backend reachable"
curl -fsS "$API_BASE/api/v1/health" >/tmp/smoke-auth-health.json

echo "[smoke-auth] check unauthenticated request"
NO_TOKEN_RESP="$(curl -sS -X GET "$API_BASE/api/v1/me")"
if echo "$NO_TOKEN_RESP" | rg -q '"errorCode":"AUTH_REQUIRED"'; then
  echo "[smoke-auth] PASS: no token gets AUTH_REQUIRED"
else
  echo "[smoke-auth] FAIL: expected AUTH_REQUIRED without token"
  echo "$NO_TOKEN_RESP"
  exit 1
fi

if [ -n "${SMOKE_BEARER_TOKEN:-}" ]; then
  echo "[smoke-auth] check bearer token"
  WITH_TOKEN_RESP="$(curl -sS -H "Authorization: Bearer ${SMOKE_BEARER_TOKEN}" "$API_BASE/api/v1/me")"
  if echo "$WITH_TOKEN_RESP" | rg -q '"id":"'; then
    echo "[smoke-auth] PASS: bearer token accepted"
  else
    echo "[smoke-auth] FAIL: bearer token response unexpected"
    echo "$WITH_TOKEN_RESP"
    exit 1
  fi
else
  echo "[smoke-auth] SKIP: set SMOKE_BEARER_TOKEN to verify authenticated path"
fi

echo "[smoke-auth] DONE"
