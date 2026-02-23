#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

SERVER_PORT="${SMOKE_COMPOSE_SERVER_PORT:-3130}"
API_BASE="${SMOKE_COMPOSE_API_BASE:-http://localhost:${SERVER_PORT}}"
SERVER_LOG="/tmp/paper-smoke-compose-server.log"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "[smoke-compose] seed demo data"
npm run db:seed:demo >/tmp/paper-smoke-compose-seed.log

echo "[smoke-compose] start server on ${SERVER_PORT}"
PORT="$SERVER_PORT" AUTH_DEV_FALLBACK=true npm run server:start >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for i in {1..40}; do
  if curl -fsS "$API_BASE/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "[smoke-compose] query demo questions"
QUESTIONS_RESP="$(curl -sS "$API_BASE/api/questions?page=1&pageSize=50&sourceExam=SMOKE_DEMO")"
QUESTION_IDS="$(printf '%s' "$QUESTIONS_RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s);const ids=(j.data||[]).slice(0,3).map(x=>x.id);if(!ids.length){process.exit(2)};process.stdout.write(JSON.stringify(ids));});")"
if [[ -z "$QUESTION_IDS" ]]; then
  echo "[smoke-compose] FAIL: no demo questions"
  echo "$QUESTIONS_RESP"
  exit 1
fi

echo "[smoke-compose] create paperset"
CREATE_RESP="$(curl -sS -X POST "$API_BASE/api/papersets" -H 'Content-Type: application/json' -d '{"name":"Smoke Compose Set"}')"
PAPERSET_ID="$(printf '%s' "$CREATE_RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s);const id=j?.data?.id;if(!id)process.exit(2);process.stdout.write(id);});")"

echo "[smoke-compose] batch select"
BATCH_RESP="$(curl -sS -X POST "$API_BASE/api/papersets/${PAPERSET_ID}/items/batch-select" -H 'Content-Type: application/json' -d "{\"questionIds\":${QUESTION_IDS}}")"
if [[ "$BATCH_RESP" != *'"error":null'* ]]; then
  echo "[smoke-compose] FAIL: batch select failed"
  echo "$BATCH_RESP"
  exit 1
fi

echo "[smoke-compose] export latex"
LATEX_RESP="$(curl -sS -X POST "$API_BASE/api/papersets/${PAPERSET_ID}/export-latex")"
if [[ "$LATEX_RESP" != *'\documentclass'* ]]; then
  echo "[smoke-compose] FAIL: export-latex did not return latex document"
  exit 1
fi

echo "[smoke-compose] export word"
curl -sS -D /tmp/paper-smoke-compose-word-head.txt -o /tmp/paper-smoke-compose.docx \
  -X POST "$API_BASE/api/papersets/${PAPERSET_ID}/export-word" >/dev/null
if ! head -n 20 /tmp/paper-smoke-compose-word-head.txt | rg -q "200 OK"; then
  echo "[smoke-compose] FAIL: export-word status is not 200"
  sed -n '1,80p' /tmp/paper-smoke-compose-word-head.txt
  exit 1
fi

echo "[smoke-compose] check question patch"
FIRST_ID="$(printf '%s' "$QUESTION_IDS" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const a=JSON.parse(s);process.stdout.write(a[0]);});")"
PATCH_RESP="$(curl -sS -X PATCH "$API_BASE/api/questions/${FIRST_ID}" -H 'Content-Type: application/json' -d '{"source":"SMOKE_PATCHED_SOURCE"}')"
if [[ "$PATCH_RESP" != *'"error":null'* ]]; then
  echo "[smoke-compose] FAIL: question patch failed"
  echo "$PATCH_RESP"
  exit 1
fi

echo "[smoke-compose] DONE"
