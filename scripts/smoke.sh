#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_BASE="http://localhost:3100"
STARTED_BY_SCRIPT=0
SERVER_PID=""

beijing_date() {
  TZ=Asia/Shanghai date +%F
}

wait_for_server() {
  local retries=30
  while [ "$retries" -gt 0 ]; do
    if curl -fsS "$API_BASE/api/health" >/dev/null 2>&1; then
      return 0
    fi
    retries=$((retries - 1))
    sleep 1
  done
  return 1
}

cleanup() {
  if [ "$STARTED_BY_SCRIPT" -eq 1 ] && [ -n "$SERVER_PID" ]; then
    kill -INT "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if ! curl -fsS "$API_BASE/api/health" >/dev/null 2>&1; then
  echo "[smoke] backend not reachable, starting server..."
  npm run server:start >/tmp/paperlatexset-smoke-server.log 2>&1 &
  SERVER_PID="$!"
  STARTED_BY_SCRIPT=1
  if ! wait_for_server; then
    echo "[smoke] FAIL: server did not become ready"
    sed -n '1,120p' /tmp/paperlatexset-smoke-server.log || true
    exit 1
  fi
fi

echo "[smoke] PASS: health reachable"
curl -fsS "$API_BASE/api/health" >/tmp/smoke-health.json

curl -fsS "$API_BASE/api/v1/health" >/tmp/smoke-v1-health.json
echo "[smoke] PASS: v1 health reachable"

ME_RESP="$(curl -sS "$API_BASE/api/v1/me")"
if echo "$ME_RESP" | rg -q '"id":"dev-teacher-id"'; then
  echo "[smoke] PASS: v1 me reachable"
else
  echo "[smoke] FAIL: v1 me response unexpected"
  echo "$ME_RESP"
  exit 1
fi

curl -fsS -X POST "$API_BASE/api/client-events/open" \
  -H 'Content-Type: application/json' \
  -d '{"path":"/smoke","source":"smoke-script"}' >/tmp/smoke-open.json

echo "[smoke] PASS: client open event"

PARSE_RESP="$(curl -sS -X POST "$API_BASE/api/parse-latex" -H 'Content-Type: application/json' -d '{"latexCode":""}')"
if echo "$PARSE_RESP" | rg -q '"errorCode":"LATEX_REQUIRED"'; then
  echo "[smoke] PASS: parse-latex returns LATEX_REQUIRED"
else
  echo "[smoke] FAIL: parse-latex did not return LATEX_REQUIRED"
  echo "$PARSE_RESP"
  exit 1
fi

ANALYZE_RESP="$(curl -sS -X POST "$API_BASE/api/analyze")"
if echo "$ANALYZE_RESP" | rg -q '"errorCode":"NO_FILES"'; then
  echo "[smoke] PASS: analyze returns NO_FILES"
else
  echo "[smoke] FAIL: analyze did not return NO_FILES"
  echo "$ANALYZE_RESP"
  exit 1
fi

ACCESS_LOG="logs/access-$(beijing_date).log"
CLIENT_LOG="logs/client-event-$(beijing_date).log"

if [ -f "$ACCESS_LOG" ] && [ -f "$CLIENT_LOG" ]; then
  echo "[smoke] PASS: logs created"
else
  echo "[smoke] FAIL: expected log files missing"
  ls -la logs || true
  exit 1
fi

echo "[smoke] access tail"
tail -n 3 "$ACCESS_LOG" || true

echo "[smoke] client tail"
tail -n 3 "$CLIENT_LOG" || true

# Ensure async log append is flushed before cleanup trap stops the server.
sleep 1

echo "[smoke] DONE"
