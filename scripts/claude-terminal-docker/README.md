# Claude Terminal Docker Scripts

Scripts for optimized Docker-based Claude Terminal with persistent memory.

## Quick Start

```bash
# Load aliases
source scripts/claude-terminal-docker/claude-aliases.sh

# Start Claude with dangerous mode
claude-start
```

## Scripts

| Script | Description |
|--------|-------------|
| `claude-aliases.sh` | Shell aliases (source this) |
| `claude-clean.sh` | Docker cleanup (safe/deep modes) |
| `claude-status.sh` | System status dashboard |
| `claude-backup.sh` | Backup memory/context |

## Commands

- `claude-start` - Start optimized container with autoapprove
- `claude-status` - Show Docker and memory status
- `claude-clean` - Safe cleanup (add --deep for full)
- `claude-backup` - Backup memory directory

## Container Config

- Memory: `~/.claude-memory` mounted to `/root/.claude`
- Project: Current directory mounted to `/workspace`
- Mode: `CLAUDE_DANGEROUS_MODE=1` + `--dangerously-skip-permissions`
