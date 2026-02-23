#!/usr/bin/env bash
set -euo pipefail

API_BASE="${SMOKE_API_BASE:-http://localhost:3100}"
ROLE_CLAIM_PATH="${SMOKE_ROLE_CLAIM_PATH:-app_metadata.role}"

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

  CLAIM_ROLE="$(ROLE_CLAIM_PATH="$ROLE_CLAIM_PATH" node -e '
const token = process.env.SMOKE_BEARER_TOKEN || "";
const path = (process.env.ROLE_CLAIM_PATH || "app_metadata.role").split(".").filter(Boolean);
function b64urlDecode(s) {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (norm.length % 4 || 4)) % 4);
  return Buffer.from(norm + pad, "base64").toString("utf8");
}
try {
  const parts = token.split(".");
  if (parts.length < 2) process.exit(0);
  const payload = JSON.parse(b64urlDecode(parts[1]));
  let cur = payload;
  for (const key of path) {
    if (!cur || typeof cur !== "object" || !(key in cur)) {
      cur = "";
      break;
    }
    cur = cur[key];
  }
  process.stdout.write(typeof cur === "string" ? cur : "");
} catch {
  process.exit(0);
}
')"
  if [ -n "$CLAIM_ROLE" ]; then
    echo "[smoke-auth] token claim role($ROLE_CLAIM_PATH): $CLAIM_ROLE"
  else
    echo "[smoke-auth] WARN: token claim role($ROLE_CLAIM_PATH) not found"
  fi

  if [ -n "${SMOKE_EXPECTED_ROLE:-}" ] && [ "$TOKEN_ROLE" != "$SMOKE_EXPECTED_ROLE" ]; then
    echo "[smoke-auth] FAIL: expected mapped role=$SMOKE_EXPECTED_ROLE but got $TOKEN_ROLE"
    exit 1
  fi

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
