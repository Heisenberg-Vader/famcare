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
