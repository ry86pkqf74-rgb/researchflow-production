#!/bin/bash
# Source this file: source scripts/claude-terminal-docker/claude-aliases.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

claude-clean() { "$SCRIPT_DIR/claude-clean.sh" "$@"; }
claude-status() { "$SCRIPT_DIR/claude-status.sh"; }
claude-backup() { "$SCRIPT_DIR/claude-backup.sh"; }
claude-start() {
    docker rm -f claude-researchflow 2>/dev/null
    docker run -it --rm --name claude-researchflow \
        -v ~/.claude-memory:/root/.claude \
        -v "$(pwd)":/workspace \
        -v ~/.gitconfig:/root/.gitconfig:ro \
        -v ~/.config/gh:/root/.config/gh:ro \
        -w /workspace \
        -e CLAUDE_DANGEROUS_MODE=1 \
        -e GH_TOKEN="$(gh auth token 2>/dev/null)" \
        docker/sandbox-templates:claude-code \
        claude --dangerously-skip-permissions
}

echo 'Claude functions loaded: claude-clean, claude-status, claude-backup, claude-start'
