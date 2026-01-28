# 🚀 QUICK START: Claude Coworker Tool Verification

**Copy this entire block to start any Claude Coworker session:**

---

```
You have access to a comprehensive AI tool ecosystem. VERIFY AND USE ALL TOOLS.

## IMMEDIATE VERIFICATION (Run Now)

### 1. MCP Integrations
Figma:whoami
Linear:get_user query="me"  
Notion:notion-get-users query="logan"

### 2. Environment Check
```bash
docker compose ps
npm --version
git status
```

### 3. Report Your Tools
Create a status table:
| Tool | Available? | Working? |
|------|-----------|----------|
| Figma MCP | | |
| Linear MCP | | |
| Notion MCP | | |
| Vercel MCP | | |
| Cursor | | |
| Continue.dev | | |
| Codex/GPT-4 | | |
| Replit | | |
| v0.dev | | |

## TOOL USAGE RULES (MANDATORY)

### For UI Components:
1. FIRST: `Figma:get_design_context` - get specs
2. THEN: v0.dev or Cursor Composer - generate scaffold
3. THEN: Integrate with existing patterns
4. THEN: Polish with Continue.dev

### For Code Generation:
- Types/Schemas → Codex or GPT-4
- Complex Logic → Claude
- Boilerplate → Copilot/Continue.dev
- Multi-file edits → Cursor

### For Project Management:
- Issues → Linear MCP
- Docs → Notion MCP
- Commits → git CLI

### For Prototyping:
- Quick UI → v0.dev
- Full prototype → Replit
- Component isolation → CodeSandbox

## PARALLEL EXECUTION

ALWAYS work on multiple things:
- Waiting for API? → Create Linear issue
- Waiting for Figma? → Plan architecture
- Waiting for build? → Write tests

## COMMIT AFTER EVERY TASK
```bash
git add -A
git commit -m "[TASK-ID] description"
git push origin main
```

## IF A TOOL FAILS
1. Note the error
2. Use fallback tool
3. Continue working
4. Report issue at checkpoint

---

BEGIN VERIFICATION NOW. Report status before proceeding.
```

---

## Quick Reference Card

| Need This | Use This Tool | Command/Action |
|-----------|---------------|----------------|
| UI design specs | Figma MCP | `Figma:get_design_context` |
| Generate UI fast | v0.dev | Prompt on v0.dev website |
| Multi-file edit | Cursor | ⌘+I Composer |
| Inline completion | Continue.dev | Just type, Tab to accept |
| Type generation | Codex | API call or IDE |
| Complex logic | Claude | Direct prompt |
| Create issue | Linear MCP | `Linear:create_issue` |
| Update docs | Notion MCP | `Notion:notion-update-page` |
| Prototype | Replit | Create React Repl |
| Test code | Grok | Code review prompt |

---

## Troubleshooting Quick Fixes

**Figma not working?**
→ User needs to reconnect in Claude settings

**Linear permission denied?**
→ Check `Linear:list_teams` first

**Cursor not available?**
→ Fallback to Continue.dev or manual editing

**Replit not connected?**
→ Use React Artifacts or v0.dev instead

**v0.dev rate limited?**
→ Use Cursor Composer with detailed prompt

---

## Phase 4 Tool Assignments

| Stream | Primary | Secondary | Fallback |
|--------|---------|-----------|----------|
| 4A: API | Codex | Cursor | Claude |
| 4B: WebSocket | Claude | Continue.dev | Manual |
| 4C: Live Run | v0.dev + Cursor | Figma | Mercury |
| 4D: Artifacts | v0.dev + Cursor | Continue.dev | Manual |
| 4E: Polish | Cursor | Continue.dev | Manual |
| 4F: Testing | Codex + Grok | Playwright | Manual |

---

*Print this page and keep it visible during execution*
