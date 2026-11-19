#!/usr/bin/env bash
# Installs Claude Code hooks and git hooks for the CarePal repo.
# Run once from the repository root: bash setup-hooks.sh
set -euo pipefail

if [ ! -d .git ]; then
  echo "Run this from the repository root (no .git folder found)." >&2
  exit 1
fi
command -v jq >/dev/null || { echo "jq is required: sudo apt install -y jq" >&2; exit 1; }

mkdir -p .claude/hooks .githooks

# ---------------------------------------------------------------------------
# Claude Code: hook registration
# ---------------------------------------------------------------------------
cat > .claude/settings.json <<'EOF'
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/session-context.sh" }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Read|Edit|Write|MultiEdit|Bash",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard.sh" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/check-file.sh", "timeout": 60 }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/quality-gate.sh", "timeout": 300 }
        ]
      }
    ]
  }
}
EOF

# ---------------------------------------------------------------------------
# SessionStart: give Claude the current repository state
# ---------------------------------------------------------------------------
cat > .claude/hooks/session-context.sh <<'EOF'
#!/usr/bin/env bash
# Prints repository state at session start; Claude Code adds stdout to the session context.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
echo "## Repository state at session start"
echo "Branch: $(git branch --show-current 2>/dev/null || echo 'none')"
echo "Recent commits:"
git log --oneline -8 2>/dev/null || echo "(no commits yet)"
echo "Uncommitted changes:"
git status --short 2>/dev/null | head -n 30
echo "Node: $(node -v 2>/dev/null || echo 'not found')"
echo "Reminder: follow CLAUDE.md, work one phase at a time, finish with npm run check passing."
exit 0
EOF

# ---------------------------------------------------------------------------
# PreToolUse: block secret access and destructive commands
# ---------------------------------------------------------------------------
cat > .claude/hooks/guard.sh <<'EOF'
#!/usr/bin/env bash
# Blocks reads and writes of secret files and a fixed list of destructive shell commands.
# Exit code 2 cancels the tool call and returns stderr to Claude.
input="$(cat)"
tool="$(jq -r '.tool_name // ""' <<<"$input")"
path="$(jq -r '.tool_input.file_path // .tool_input.path // ""' <<<"$input")"
cmd="$(jq -r '.tool_input.command // ""' <<<"$input")"

# Secret files: .env and its variants (except .env.example), service-account keys, secrets folders.
secret_path_re='(^|/)\.env(\.(local|development|production|test))?$|service-account[^/]*\.json$|-sa\.json$|(^|/)secrets/|(^|/)\.secret'

block() {
  echo "Blocked by project guard: $1" >&2
  exit 2
}

case "$tool" in
  Read|Edit|Write|MultiEdit)
    if [[ "$path" =~ $secret_path_re ]]; then
      block "$path is a secret file. Variable names are listed in CLAUDE.md section 10; ask the developer if a value must change."
    fi
    ;;
  Bash)
    # Secret files referenced in a command (cat .env, git add .env, cp key.json ...). .env.example is allowed.
    stripped="${cmd//.env.example/}"
    if grep -Eq '(^|[[:space:]/"'"'"'])\.env(\.(local|development|production|test))?([[:space:]"'"'"';|&>]|$)|service-account[^[:space:]]*\.json|-sa\.json|/secrets/' <<<"$stripped"; then
      block "the command touches a secret file. Do not read, copy, print or stage secrets."
    fi
    # Destructive or check-bypassing commands.
    if grep -Eq 'git[[:space:]]+push[^|;&]*(--force|-f([[:space:]]|$))|git[[:space:]]+reset[[:space:]]+--hard|git[[:space:]]+clean[[:space:]]+-[a-z]*f|--no-verify|rm[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*f?[[:space:]]+(/|~|\$HOME|\.\.?)([[:space:]]|/?$)|firestore:delete|projects:delete|auth:delete' <<<"$cmd"; then
      block "destructive or check-bypassing command. Ask the developer to run it manually if it is really needed."
    fi
    ;;
esac
exit 0
EOF

# ---------------------------------------------------------------------------
# PostToolUse: format and lint the file that was just edited
# ---------------------------------------------------------------------------
cat > .claude/hooks/check-file.sh <<'EOF'
#!/usr/bin/env bash
# Formats and lints the edited file and rejects private keys written into source files.
# Exit code 2 returns the problems to Claude so it fixes them immediately.
input="$(cat)"
path="$(jq -r '.tool_input.file_path // ""' <<<"$input")"
[ -n "$path" ] && [ -f "$path" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

case "$path" in
  */node_modules/*|*/dist/*) exit 0 ;;
esac

if grep -Eq 'BEGIN (RSA |EC )?PRIVATE KEY|"private_key"[[:space:]]*:' "$path"; then
  echo "$path contains a private key. Remove it and load credentials from the environment instead." >&2
  exit 2
fi

case "$path" in
  *.js|*.jsx|*.mjs|*.cjs|*.ts|*.tsx|*.json|*.css|*.md|*.html)
    if [ -x node_modules/.bin/prettier ]; then
      node_modules/.bin/prettier --write --log-level=error "$path" >/dev/null 2>&1 || true
    fi
    ;;
esac

case "$path" in
  *.js|*.jsx|*.mjs|*.cjs|*.ts|*.tsx)
    if [ -x node_modules/.bin/eslint ]; then
      if ! out="$(node_modules/.bin/eslint "$path" 2>&1)"; then
        { echo "ESLint errors in $path (fix them now):"; echo "$out" | tail -n 40; } >&2
        exit 2
      fi
    fi
    ;;
esac
exit 0
EOF

# ---------------------------------------------------------------------------
# Stop: full quality gate before Claude is allowed to finish a turn
# ---------------------------------------------------------------------------
cat > .claude/hooks/quality-gate.sh <<'EOF'
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
EOF

# ---------------------------------------------------------------------------
# Git hooks: backstop for every commit and push, whoever makes it
# ---------------------------------------------------------------------------
cat > .githooks/pre-commit <<'EOF'
#!/usr/bin/env bash
# Rejects commits that include secrets, lint errors or failing unit tests.
set -uo pipefail
staged="$(git diff --cached --name-only --diff-filter=ACMR)"
[ -n "$staged" ] || exit 0

if grep -Eq '(^|/)\.env(\.(local|development|production|test))?$|service-account[^/]*\.json$|-sa\.json$' <<<"$staged"; then
  echo "pre-commit: refusing to commit secret files:" >&2
  grep -E '(^|/)\.env(\.(local|development|production|test))?$|service-account[^/]*\.json$|-sa\.json$' <<<"$staged" >&2
  echo "Unstage them with: git restore --staged <file>" >&2
  exit 1
fi

if git diff --cached -U0 | grep -E '^\+' | grep -Eq 'BEGIN (RSA |EC )?PRIVATE KEY|"private_key"[[:space:]]*:'; then
  echo "pre-commit: a private key is being committed. Remove it." >&2
  exit 1
fi

[ -f package.json ] && [ -d node_modules ] || exit 0

js="$(grep -E '\.(js|jsx|mjs|cjs|ts|tsx)$' <<<"$staged" || true)"
if [ -n "$js" ] && [ -x node_modules/.bin/eslint ]; then
  # shellcheck disable=SC2086
  node_modules/.bin/eslint $js || { echo "pre-commit: fix ESLint errors first." >&2; exit 1; }
fi

npm run --silent --if-present test || { echo "pre-commit: unit tests are failing." >&2; exit 1; }
exit 0
EOF

cat > .githooks/pre-push <<'EOF'
#!/usr/bin/env bash
# Runs the full check, plus Firestore rules tests when they exist, before anything reaches GitHub.
set -uo pipefail
[ -f package.json ] && [ -d node_modules ] || exit 0

if jq -e '.scripts.check' package.json >/dev/null 2>&1; then
  npm run --silent check || { echo "pre-push: npm run check failed." >&2; exit 1; }
else
  npm run --silent --if-present lint && npm run --silent --if-present test && npm run --silent --if-present build \
    || { echo "pre-push: lint, tests or build failed." >&2; exit 1; }
fi

if jq -e '.scripts["test:rules"]' package.json >/dev/null 2>&1; then
  npm run --silent test:rules || { echo "pre-push: Firestore rules tests failed." >&2; exit 1; }
fi
exit 0
EOF

chmod +x .claude/hooks/*.sh .githooks/*
git config core.hooksPath .githooks

# Claude Code's personal settings file must never be committed.
touch .gitignore
grep -qxF '.claude/settings.local.json' .gitignore || echo '.claude/settings.local.json' >> .gitignore

echo "Hooks installed:"
echo "  Claude Code: .claude/settings.json + .claude/hooks/*.sh"
echo "  Git:         .githooks/pre-commit, .githooks/pre-push (core.hooksPath set)"
echo "Restart Claude Code (or open /hooks) so it loads the new settings."
