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
