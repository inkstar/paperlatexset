#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "[pre-push-check] Error: not inside git repo."
  exit 1
fi
cd "$REPO_ROOT"

REQUIRE_PLAN_CHANGED="${REQUIRE_PLAN_CHANGED:-1}"
ALLOW_UNTRACKED_REGEX="${ALLOW_UNTRACKED_REGEX:-^(test_image/|test_output/).+}"
COMMIT_SUBJECT="${1:-}"

echo "[pre-push-check] repo: $REPO_ROOT"

if [[ "$REQUIRE_PLAN_CHANGED" == "1" ]]; then
  if ! git diff --cached --name-only | rg -q '^PLAN\.md$'; then
    echo "[pre-push-check] FAIL: staged changes must include PLAN.md"
    exit 1
  fi
fi

UNTRACKED="$(git ls-files --others --exclude-standard || true)"
if [[ -n "$UNTRACKED" ]]; then
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    if ! echo "$path" | rg -q "$ALLOW_UNTRACKED_REGEX"; then
      echo "[pre-push-check] FAIL: unexpected untracked file: $path"
      exit 1
    fi
  done <<< "$UNTRACKED"
fi

if [[ -n "$COMMIT_SUBJECT" ]]; then
  if ! echo "$COMMIT_SUBJECT" | rg -q '^(feat|fix|chore)\(phase-[0-9]+\.[0-9]+\): .+'; then
    echo "[pre-push-check] FAIL: commit subject does not match phase template"
    echo "  expected: feat(phase-x.y): ... | fix(phase-x.y): ... | chore(phase-x.y): ..."
    exit 1
  fi
fi

echo "[pre-push-check] PASS"
