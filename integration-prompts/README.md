# Integration Prompts for Claude Code

This directory contains integration task prompts that Claude Code can execute against the ResearchFlow codebase.

## Directory Structure

```
integration-prompts/
├── README.md                    # This file
├── tasks/                       # Individual task prompts
│   ├── 001-run-tests.md
│   ├── 002-lint-fix.md
│   └── ...
├── workflows/                   # Multi-step workflow prompts
│   ├── full-ci-pipeline.md
│   └── deploy-staging.md
└── templates/                   # Prompt templates
    ├── bug-fix-template.md
    └── feature-template.md
```

## How to Execute Prompts

### Option 1: Interactive Mode
```bash
# Start the container
docker-compose -f docker-compose.claude-integration.yml up -d

# Enter the container and run Claude interactively
docker-compose -f docker-compose.claude-integration.yml exec claude-runner claude
```

### Option 2: Prompt File Mode
```bash
# Execute a specific prompt file
docker-compose -f docker-compose.claude-integration.yml exec claude-runner \
  claude --print "$(cat /workspace/integration-prompts/tasks/001-run-tests.md)"
```

### Option 3: Piped Input Mode
```bash
# Pipe prompts directly
echo "Run npm test and report results" | \
  docker-compose -f docker-compose.claude-integration.yml exec -T claude-runner claude
```

### Option 4: Batch Execution Script
```bash
# Run the batch executor
./scripts/run-integration-tasks.sh
```

## Writing Effective Integration Prompts

### Structure
1. **Context**: What is the current state?
2. **Goal**: What should be accomplished?
3. **Constraints**: Any limitations or requirements?
4. **Success Criteria**: How to verify completion?

### Example Prompt
```markdown
## Context
The ResearchFlow codebase needs integration testing before deployment.

## Goal
Run the full test suite and fix any failing tests.

## Constraints
- Do not modify production configuration
- All fixes must pass linting
- Document any changes made

## Success Criteria
- All unit tests pass
- All integration tests pass
- No new linting errors
```

## Best Practices

1. **Be Specific**: Include file paths, function names, and exact requirements
2. **Set Boundaries**: Specify what Claude should NOT modify
3. **Define Done**: Clear success criteria prevent incomplete work
4. **Use Checkpoints**: Break large tasks into verifiable steps
