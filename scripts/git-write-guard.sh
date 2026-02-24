#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/git-write-guard.sh <git-subcommand> [args...]"
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "Error: current directory is not inside a git repository."
  exit 1
fi

cd "$REPO_ROOT"

LOCK_FILE="/tmp/git_write_$(basename "$REPO_ROOT").lock"
LOCK_PID="/tmp/git_write_$(basename "$REPO_ROOT").pid"
LOCK_DIR="/tmp/git_write_$(basename "$REPO_ROOT").lockdir"

cleanup_stale_guard_lock() {
  if [[ -d "$LOCK_DIR" && ! -f "$LOCK_PID" ]]; then
    rmdir "$LOCK_DIR" >/dev/null 2>&1 || true
    return
  fi

  if [[ -d "$LOCK_DIR" && -f "$LOCK_PID" ]]; then
    local holder_pid
    holder_pid="$(cat "$LOCK_PID" 2>/dev/null || true)"
    if [[ -z "$holder_pid" ]] || ! ps -p "$holder_pid" >/dev/null 2>&1; then
      rm -f "$LOCK_PID"
      rmdir "$LOCK_DIR" >/dev/null 2>&1 || true
    fi
  fi
}

cleanup_stale_locks() {
  local git_proc_count
  git_proc_count="$(ps aux | egrep '[g]it(\s|$)|[s]sh(\s|$)|[g]pg(\s|$)' | wc -l | tr -d ' ')"
  if [[ "$git_proc_count" == "0" ]]; then
    find .git -name '*.lock' -type f -delete || true
  fi
}

run_git_write() {
  local -a cmd
  cmd=("git" "$@")
  cleanup_stale_locks
  echo "$$" > "$LOCK_PID"
  trap 'rm -f "$LOCK_PID"' EXIT
  "${cmd[@]}"
}

if command -v flock >/dev/null 2>&1; then
  flock -x "$LOCK_FILE" bash -c '
    set -euo pipefail
    '"$(declare -f cleanup_stale_locks)"'
    '"$(declare -f run_git_write)"'
    run_git_write "$@"
  ' _ "$@"
  exit 0
fi

# Portable fallback: use mkdir as an atomic lock.
for _ in $(seq 1 300); do
  cleanup_stale_guard_lock
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    trap 'rmdir "$LOCK_DIR" >/dev/null 2>&1 || true' EXIT
    run_git_write "$@"
    exit 0
  fi
  sleep 0.2
done

echo "Error: git write lock timeout (${LOCK_DIR})."
exit 1
