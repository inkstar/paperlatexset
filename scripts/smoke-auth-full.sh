#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVER_PORT="${SMOKE_SERVER_PORT:-3110}"
API_BASE="${SMOKE_API_BASE:-http://localhost:${SERVER_PORT}}"
SERVER_PID=""

read_env_value() {
  local key="$1"
  local value
  value="$(rg "^${key}=" .env.server 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"
  echo "$value"
}

pick_signing_secret() {
  if [ -n "${SMOKE_SIGNING_SECRET:-}" ]; then
    echo "$SMOKE_SIGNING_SECRET"
    return 0
  fi
  if [ -n "${SUPABASE_JWT_SECRET:-}" ]; then
    echo "$SUPABASE_JWT_SECRET"
    return 0
  fi
  if [ -n "${JWT_SECRET:-}" ]; then
    echo "$JWT_SECRET"
    return 0
  fi

  local env_supabase env_jwt
  env_supabase="$(read_env_value SUPABASE_JWT_SECRET)"
  env_jwt="$(read_env_value JWT_SECRET)"
  if [ -n "$env_supabase" ]; then
    echo "$env_supabase"
    return 0
  fi
  if [ -n "$env_jwt" ]; then
    echo "$env_jwt"
    return 0
  fi

  echo ""
}

wait_for_server() {
  local retries=60
  while [ "$retries" -gt 0 ]; do
    if curl -fsS "$API_BASE/api/v1/health" >/dev/null 2>&1; then
      return 0
    fi
    if [ -n "$SERVER_PID" ] && ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
      return 1
    fi
    retries=$((retries - 1))
    sleep 1
  done
  return 1
}

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill -INT "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

SIGNING_SECRET="$(pick_signing_secret)"
if [ -z "$SIGNING_SECRET" ]; then
  echo "[smoke-auth-full] FAIL: cannot resolve signing secret (set SMOKE_SIGNING_SECRET)"
  exit 1
fi

echo "[smoke-auth-full] start strict auth server on port $SERVER_PORT"
AUTH_DEV_FALLBACK=false \
PORT="$SERVER_PORT" \
SUPABASE_JWT_SECRET="$SIGNING_SECRET" \
JWT_SECRET="$SIGNING_SECRET" \
npm run server:start >/tmp/paper-auth-full-server.log 2>&1 &
SERVER_PID="$!"

if ! wait_for_server; then
  echo "[smoke-auth-full] FAIL: server did not become ready"
  sed -n '1,120p' /tmp/paper-auth-full-server.log || true
  exit 1
fi

echo "[smoke-auth-full] run auth matrix on $API_BASE"
SMOKE_API_BASE="$API_BASE" \
SMOKE_SIGNING_SECRET="$SIGNING_SECRET" \
SMOKE_TOKEN_ISSUER="${SMOKE_TOKEN_ISSUER:-}" \
SMOKE_TOKEN_AUDIENCE="${SMOKE_TOKEN_AUDIENCE:-}" \
npm run smoke:auth:matrix

echo "[smoke-auth-full] DONE"
