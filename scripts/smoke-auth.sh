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
  if echo "$WITH_TOKEN_RESP" | rg -q '"id":"' && echo "$WITH_TOKEN_RESP" | rg -q '"mode":"bearer"'; then
    echo "[smoke-auth] PASS: bearer token accepted"
  else
    echo "[smoke-auth] FAIL: bearer token response unexpected"
    echo "$WITH_TOKEN_RESP"
    exit 1
  fi

  TOKEN_ROLE="$(echo "$WITH_TOKEN_RESP" | rg -o '"role":"[^"]+"' | head -n 1 | cut -d: -f2 | tr -d '"')"
  if [ -z "$TOKEN_ROLE" ]; then
    echo "[smoke-auth] FAIL: cannot detect role from /api/v1/me response"
    echo "$WITH_TOKEN_RESP"
    exit 1
  fi
  echo "[smoke-auth] detected role: $TOKEN_ROLE"

  ADMIN_AUTHZ_RESP="$(curl -sS -i -H "Authorization: Bearer ${SMOKE_BEARER_TOKEN}" "$API_BASE/api/v1/authz/admin")"
  if [ "$TOKEN_ROLE" = "admin" ]; then
    if echo "$ADMIN_AUTHZ_RESP" | rg -q "HTTP/1.1 200" && echo "$ADMIN_AUTHZ_RESP" | rg -q '"allowed":true'; then
      echo "[smoke-auth] PASS: admin role can access /api/v1/authz/admin"
    else
      echo "[smoke-auth] FAIL: admin role should access /api/v1/authz/admin"
      echo "$ADMIN_AUTHZ_RESP"
      exit 1
    fi
  else
    if echo "$ADMIN_AUTHZ_RESP" | rg -q "HTTP/1.1 403" && echo "$ADMIN_AUTHZ_RESP" | rg -q '"errorCode":"AUTH_FORBIDDEN"'; then
      echo "[smoke-auth] PASS: non-admin role blocked by /api/v1/authz/admin"
    else
      echo "[smoke-auth] FAIL: non-admin role should be forbidden on /api/v1/authz/admin"
      echo "$ADMIN_AUTHZ_RESP"
      exit 1
    fi
  fi
else
  echo "[smoke-auth] SKIP: set SMOKE_BEARER_TOKEN to verify authenticated path"
fi

echo "[smoke-auth] DONE"
