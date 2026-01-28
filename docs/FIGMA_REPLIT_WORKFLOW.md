# Figma-to-Replit Rapid Prototyping Workflow

## Overview
This workflow enables rapid conversion of Figma designs to working code prototypes using Replit Agent, maximizing unused credits across both platforms.

## Prerequisites

### Figma Setup
1. Open Figma desktop app
2. Enable Dev Mode MCP Server: **Figma menu → Preferences → Enable Dev Mode MCP Server**
3. Restart Claude desktop app

### Replit Setup
1. Get API token from https://replit.com/account#api
2. Add to `.env`: `REPLIT_API_TOKEN=your_token_here`

## Workflow Steps

### Step 1: Extract Design from Figma
```
# In Claude, with Figma file open:
"Extract the design context from the selected component"
```
This captures:
- Component structure
- Design tokens (colors, typography, spacing)
- Layout information
- Variable definitions

### Step 2: Generate Code with Claude
```
# Claude generates React/TypeScript code from the design
"Generate a React component matching this Figma design using Tailwind CSS"
```

### Step 3: Deploy to Replit
```
# Push to Replit for live preview
"Create a new Replit project with this component and deploy it"
```

## Recommended Use Cases

| Design Type | Best Tool Combination |
|-------------|----------------------|
| UI Components | Figma → Claude → Replit |
| Landing Pages | Figma → Mercury (fast) → Replit |
| Data Dashboards | Figma → GPT-4 → Replit |
| Forms | Figma → Claude → Replit |

## Token Optimization Strategy

### Figma Credits
- Use for: Design extraction, screenshots, variable definitions
- Skip for: Simple components (use Claude's imagination)

### Replit Credits
- Use for: Live deployments, collaborative editing, hosting
- Skip for: Local-only development (use LM Studio)

### Monthly Budget Tracking
All usage tracked in Notion: **🎯 AI Tool Usage Plans**

## Quick Commands

```bash
# Check Figma connection
curl -H "X-Figma-Token: $FIGMA_API_KEY" https://api.figma.com/v1/me

# Check Replit connection
curl -H "Authorization: Bearer $REPLIT_API_TOKEN" https://replit.com/api/v0/me
```

## Integration with ResearchFlow

The prototyped components can be directly integrated into ResearchFlow:
1. Export from Replit as React component
2. Copy to `services/web/src/components/`
3. Import design tokens to `tailwind.config.js`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Figma MCP not connecting | Restart Figma and Claude desktop |
| Replit deployment fails | Check API token permissions |
| Design tokens missing | Enable Dev Mode in Figma |
