#!/bin/bash
# Source this file: source scripts/claude-terminal-docker/claude-aliases.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

alias claude-clean="$SCRIPT_DIR/claude-clean.sh"
alias claude-status="$SCRIPT_DIR/claude-status.sh"
alias claude-backup="$SCRIPT_DIR/claude-backup.sh"
alias claude-start="docker run -it --rm --name claude-researchflow -v ~/.claude-memory:/root/.claude -v \$(pwd):/workspace -w /workspace -e CLAUDE_DANGEROUS_MODE=1 docker/sandbox-templates:claude-code claude --dangerously-skip-permissions"

echo "Claude aliases loaded: claude-clean, claude-status, claude-backup, claude-start"
