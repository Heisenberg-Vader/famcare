#!/usr/bin/env bash
# Runs lint, tests and build whenever Claude Code finishes a turn.
# A failure blocks completion (exit 2) and sends the output back to Claude.
# After 3 consecutive failures in one session it stops blocking and alerts the developer instead.
input="$(cat)"
session="$(jq -r '.session_id // "default"' <<<"$input")"
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# Nothing to check before the project is scaffolded and dependencies are installed.
[ -f package.json ] && [ -d node_modules ] || exit 0

counter="/tmp/carepal-gate-${session}"
log="$(mktemp)"

if jq -e '.scripts.check' package.json >/dev/null 2>&1; then
  npm run --silent check >"$log" 2>&1
else
  { npm run --silent --if-present lint && npm run --silent --if-present test && npm run --silent --if-present build; } >"$log" 2>&1
fi
status=$?

if [ "$status" -eq 0 ]; then
  rm -f "$counter" "$log"
  exit 0
fi

attempts=$(( $(cat "$counter" 2>/dev/null || echo 0) + 1 ))
echo "$attempts" > "$counter"

if [ "$attempts" -ge 3 ]; then
  rm -f "$counter"
  { echo "Quality gate still failing after 3 attempts. Stopping for developer review. Last output:"; tail -n 40 "$log"; } >&2
  rm -f "$log"
  exit 1
fi

{
  echo "Quality gate failed (attempt $attempts of 3): lint, tests or build are broken."
  echo "Fix the cause. Do not delete, skip or weaken tests, and do not disable lint rules, to make this pass."
  echo "--- last 60 lines of output ---"
  tail -n 60 "$log"
} >&2
rm -f "$log"
exit 2
