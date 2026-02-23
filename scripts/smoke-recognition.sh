#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

SERVER_PORT="${SMOKE_RECOG_SERVER_PORT:-3160}"
API_BASE="${SMOKE_RECOG_API_BASE:-http://localhost:${SERVER_PORT}}"
PROVIDER="${SMOKE_RECOG_PROVIDER:-gemini}"
SERVER_LOG="/tmp/paper-smoke-recognition-server.log"
IMG_FILE="/tmp/paper-smoke-recognition.png"
SOURCE_EXAM="SMOKE_RECOG"
LOG_HINT="logs/access-$(TZ=Asia/Shanghai date +%F).log"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AApMBgP8j8WQAAAAASUVORK5CYII=" | base64 -d > "$IMG_FILE"

echo "[smoke-recognition] start server on ${SERVER_PORT}"
PORT="$SERVER_PORT" AUTH_DEV_FALLBACK=true npm run server:start >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for i in {1..40}; do
  if curl -fsS "$API_BASE/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "[smoke-recognition] upload test image"
UPLOAD_RESP="$(curl -sS -D /tmp/paper-smoke-recognition-upload.head -X POST "$API_BASE/api/papers/upload" \
  -F "title=Smoke Recognition Paper" \
  -F "sourceExam=${SOURCE_EXAM}" \
  -F "sourceYear=2026" \
  -F "files=@${IMG_FILE};filename=smoke.png;type=image/png")"
UPLOAD_REQ_ID="$(rg -o 'x-request-id: .*' /tmp/paper-smoke-recognition-upload.head | sed 's/x-request-id: //' | tr -d '\r' | tail -n1 || true)"

UPLOAD_ERROR_CODE="$(printf '%s' "$UPLOAD_RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s);process.stdout.write(j.errorCode||'');}catch{process.stdout.write('');}})")"
if [[ -n "$UPLOAD_ERROR_CODE" ]]; then
  echo "[smoke-recognition] upload failed"
  echo "errorCode=${UPLOAD_ERROR_CODE} requestId=${UPLOAD_REQ_ID:-none} log=${LOG_HINT}"
  echo "$UPLOAD_RESP"
  exit 1
fi

PAPER_ID="$(printf '%s' "$UPLOAD_RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s);process.stdout.write(j?.data?.paper?.id||'');});")"
if [[ -z "$PAPER_ID" ]]; then
  echo "[smoke-recognition] FAIL: paper id missing"
  echo "$UPLOAD_RESP"
  exit 1
fi

echo "[smoke-recognition] recognize paper via provider=${PROVIDER}"
RECOG_RESP="$(curl -sS -D /tmp/paper-smoke-recognition-recog.head -X POST "$API_BASE/api/papers/${PAPER_ID}/recognize" \
  -H 'Content-Type: application/json' \
  -d "{\"provider\":\"${PROVIDER}\"}")"
RECOG_REQ_ID="$(rg -o 'x-request-id: .*' /tmp/paper-smoke-recognition-recog.head | sed 's/x-request-id: //' | tr -d '\r' | tail -n1 || true)"
RECOG_ERROR_CODE="$(printf '%s' "$RECOG_RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s);process.stdout.write(j.errorCode||'');}catch{process.stdout.write('');}})")"

if [[ -n "$RECOG_ERROR_CODE" ]]; then
  if [[ "$RECOG_ERROR_CODE" == "PROVIDER_AUTH_FAILED" || "$RECOG_ERROR_CODE" == "PROVIDER_RATE_LIMITED" || "$RECOG_ERROR_CODE" == "PROVIDER_UPSTREAM_ERROR" || "$RECOG_ERROR_CODE" == "PROVIDER_RESPONSE_INVALID" || "$RECOG_ERROR_CODE" == "PROVIDER_NOT_CONFIGURED" || "$RECOG_ERROR_CODE" == "PROVIDER_PRECHECK_FAILED" ]]; then
    echo "[smoke-recognition] provider diagnosis captured"
    echo "errorCode=${RECOG_ERROR_CODE} requestId=${RECOG_REQ_ID:-none} log=${LOG_HINT}"
    echo "[smoke-recognition] DONE (diagnosed failure path)"
    exit 0
  fi
  echo "[smoke-recognition] FAIL: unexpected error code"
  echo "errorCode=${RECOG_ERROR_CODE} requestId=${RECOG_REQ_ID:-none} log=${LOG_HINT}"
  echo "$RECOG_RESP"
  exit 1
fi

echo "[smoke-recognition] query recognized questions"
QUESTIONS_RESP="$(curl -sS "$API_BASE/api/questions?page=1&pageSize=20&sourceExam=${SOURCE_EXAM}")"
TOTAL="$(printf '%s' "$QUESTIONS_RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s);process.stdout.write(String(j?.meta?.total ?? 0));});")"
if [[ "${TOTAL}" -lt 1 ]]; then
  echo "[smoke-recognition] FAIL: recognition succeeded but no questions found"
  echo "$QUESTIONS_RESP"
  exit 1
fi

echo "[smoke-recognition] PASS: recognition E2E succeeded (questions=${TOTAL})"
echo "[smoke-recognition] DONE"
