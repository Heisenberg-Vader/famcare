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
