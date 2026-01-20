#!/bin/bash
# Claude Memory Backup Script

BACKUP_DIR="$HOME/.claude-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/claude-memory-$TIMESTAMP.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "📦 Backing up Claude memory..."

if [ -d "$HOME/.claude-memory" ]; then
    tar -czf "$BACKUP_FILE" -C "$HOME" .claude-memory
    echo "✅ Backup saved to: $BACKUP_FILE"
    echo ""
    echo "Recent backups:"
    ls -lh "$BACKUP_DIR" | tail -5
else
    echo "⚠️  No memory directory found at ~/.claude-memory"
fi
