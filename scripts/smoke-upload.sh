#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

SERVER_PORT="${SMOKE_UPLOAD_SERVER_PORT:-3140}"
API_BASE="${SMOKE_UPLOAD_API_BASE:-http://localhost:${SERVER_PORT}}"
SERVER_LOG="/tmp/paper-smoke-upload-server.log"
TMP_FILE="/tmp/paper-smoke-upload.txt"
echo "smoke upload content" > "$TMP_FILE"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "[smoke-upload] start server on ${SERVER_PORT}"
PORT="$SERVER_PORT" AUTH_DEV_FALLBACK=true npm run server:start >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for i in {1..40}; do
  if curl -fsS "$API_BASE/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "[smoke-upload] check /api/analyze provider fallback error code"
ANALYZE_RESP="$(curl -sS -X POST "$API_BASE/api/analyze" \
  -F "provider=unknown_provider" \
  -F "files=@${TMP_FILE};type=text/plain")"
if [[ "$ANALYZE_RESP" != *'"errorCode":"PROVIDER_NOT_CONFIGURED"'* ]]; then
  echo "[smoke-upload] FAIL: expected PROVIDER_NOT_CONFIGURED from /api/analyze"
  echo "$ANALYZE_RESP"
  exit 1
fi

echo "[smoke-upload] upload paper file"
UPLOAD_RESP="$(curl -sS -X POST "$API_BASE/api/papers/upload" \
  -F "title=SmokeUploadPaper" \
  -F "sourceExam=SMOKE_UPLOAD" \
  -F "sourceYear=2026" \
  -F "files=@${TMP_FILE};filename=smoke.txt;type=text/plain")"

if [[ "$UPLOAD_RESP" == *'"errorCode":"STORAGE_UNAVAILABLE"'* ]]; then
  echo "[smoke-upload] PASS: storage unavailable is reported with stable error code"
  echo "[smoke-upload] DONE"
  exit 0
fi

PAPER_ID="$(printf '%s' "$UPLOAD_RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s);const id=j?.data?.paper?.id;if(!id)process.exit(2);process.stdout.write(id);});")"
if [[ -z "$PAPER_ID" ]]; then
  echo "[smoke-upload] FAIL: expected paper id from upload"
  echo "$UPLOAD_RESP"
  exit 1
fi

echo "[smoke-upload] check /api/papers/:id/recognize provider fallback error code"
RECOG_RESP="$(curl -sS -X POST "$API_BASE/api/papers/${PAPER_ID}/recognize" \
  -H 'Content-Type: application/json' \
  -d '{"provider":"unknown_provider"}')"
if [[ "$RECOG_RESP" != *'"errorCode":"PROVIDER_NOT_CONFIGURED"'* ]]; then
  echo "[smoke-upload] FAIL: expected PROVIDER_NOT_CONFIGURED from recognize"
  echo "$RECOG_RESP"
  exit 1
fi

echo "[smoke-upload] DONE"
