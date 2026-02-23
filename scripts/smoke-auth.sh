#!/usr/bin/env bash
set -euo pipefail

API_BASE="${SMOKE_API_BASE:-http://localhost:3100}"
ROLE_CLAIM_PATH="${SMOKE_ROLE_CLAIM_PATH:-app_metadata.role}"

generate_test_token() {
  local role="$1"
  local secret="${SMOKE_SIGNING_SECRET:-}"
  if [ -z "$secret" ]; then
    echo ""
    return 0
  fi

  SMOKE_SIGNING_SECRET="$secret" \
  SMOKE_EXPECTED_ROLE="$role" \
  SMOKE_TOKEN_ISSUER="${SMOKE_TOKEN_ISSUER:-}" \
  SMOKE_TOKEN_AUDIENCE="${SMOKE_TOKEN_AUDIENCE:-}" \
  node -e '
const jwt = require("jsonwebtoken");
const role = process.env.SMOKE_EXPECTED_ROLE || "teacher";
const payload = {
  sub: `smoke-${role}`,
  email: `smoke-${role}@example.com`,
  role,
  app_metadata: { role },
  user_metadata: { role }
};
const opts = {};
if (process.env.SMOKE_TOKEN_ISSUER) opts.issuer = process.env.SMOKE_TOKEN_ISSUER;
if (process.env.SMOKE_TOKEN_AUDIENCE) opts.audience = process.env.SMOKE_TOKEN_AUDIENCE;
const token = jwt.sign(payload, process.env.SMOKE_SIGNING_SECRET, { algorithm: "HS256", expiresIn: "30m", ...opts });
process.stdout.write(token);
'
}

if [ -z "${SMOKE_BEARER_TOKEN:-}" ] && [ -n "${SMOKE_GENERATE_TOKEN_ROLE:-}" ]; then
  GENERATED_TOKEN="$(generate_test_token "$SMOKE_GENERATE_TOKEN_ROLE")"
  if [ -n "$GENERATED_TOKEN" ]; then
    export SMOKE_BEARER_TOKEN="$GENERATED_TOKEN"
    echo "[smoke-auth] generated test token for role=$SMOKE_GENERATE_TOKEN_ROLE"
  else
    echo "[smoke-auth] FAIL: cannot generate token (missing SMOKE_SIGNING_SECRET)"
    exit 1
  fi
fi

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
  echo "[smoke-auth] SKIP: set SMOKE_BEARER_TOKEN, or SMOKE_GENERATE_TOKEN_ROLE + SMOKE_SIGNING_SECRET"
fi

echo "[smoke-auth] DONE"
