#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

SERVER_PORT="${SMOKE_CODE_SERVER_PORT:-3120}"
API_BASE="${SMOKE_CODE_API_BASE:-http://localhost:${SERVER_PORT}}"
SERVER_LOG="/tmp/paper-auth-code-server.log"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "[smoke-auth-code] start isolated server on $SERVER_PORT"
PORT="$SERVER_PORT" \
AUTH_DEV_FALLBACK=true \
AUTH_CODE_DEBUG=true \
AUTH_CODE_EMAIL_ENABLED=false \
AUTH_CODE_PHONE_ENABLED=false \
npm run server:start >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for i in {1..30}; do
  if curl -fsS "$API_BASE/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "[smoke-auth-code] check debug mode code request"
DEBUG_RESP="$(curl -sS -X POST "$API_BASE/api/auth/code/request" \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@example.com"}')"
if [[ "$DEBUG_RESP" != *'"sent":true'* ]] || [[ "$DEBUG_RESP" != *'"debugCode"'* ]]; then
  echo "[smoke-auth-code] FAIL: expected sent=true and debugCode in debug mode"
  echo "$DEBUG_RESP"
  exit 1
fi

echo "[smoke-auth-code] restart with debug disabled"
kill "$SERVER_PID" >/dev/null 2>&1 || true
wait "$SERVER_PID" 2>/dev/null || true
unset SERVER_PID

PORT="$SERVER_PORT" \
AUTH_DEV_FALLBACK=true \
AUTH_CODE_DEBUG=false \
AUTH_CODE_EMAIL_ENABLED=false \
AUTH_CODE_PHONE_ENABLED=false \
npm run server:start >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for i in {1..30}; do
  if curl -fsS "$API_BASE/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

EMAIL_RESP="$(curl -sS -X POST "$API_BASE/api/auth/code/request" \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@example.com"}')"
if [[ "$EMAIL_RESP" != *'"errorCode":"AUTH_EMAIL_NOT_CONFIGURED"'* ]]; then
  echo "[smoke-auth-code] FAIL: expected AUTH_EMAIL_NOT_CONFIGURED"
  echo "$EMAIL_RESP"
  exit 1
fi

PHONE_RESP="$(curl -sS -X POST "$API_BASE/api/auth/code/request" \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13800138000"}')"
if [[ "$PHONE_RESP" != *'"errorCode":"AUTH_SMS_NOT_CONFIGURED"'* ]]; then
  echo "[smoke-auth-code] FAIL: expected AUTH_SMS_NOT_CONFIGURED"
  echo "$PHONE_RESP"
  exit 1
fi

echo "[smoke-auth-code] DONE"
