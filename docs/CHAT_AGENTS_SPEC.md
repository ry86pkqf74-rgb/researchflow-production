# Chat Agents Specification

## Overview
Workflow-specific AI chat agents that persist conversation history per artifact and enable human-in-the-loop editing through action proposals.

## Agent Types
| Agent Type | Mount Location | Capabilities |
|------------|----------------|--------------|
| irb | IRB Editor | Compliance edits, IRB patches, regulatory language |
| analysis | Analysis Dashboard | Method proposals, analysis plans, statistical advice |
| manuscript | Manuscript Studio | Section revisions, patches, writing assistance |

## Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/chat/:agentType/:artifactType/:artifactId/sessions | Create or get active session |
| GET | /api/chat/sessions/:sessionId/messages | Retrieve message history |
| POST | /api/chat/:agentType/:artifactType/:artifactId/message | Send message, receive AI response |
| POST | /api/chat/actions/:actionId/approve | Approve proposed action |
| POST | /api/chat/actions/:actionId/reject | Reject proposed action |

## Database Schema
### chat_sessions
- id: UUID (PK)
- project_id: UUID (nullable)
- artifact_type: TEXT (irb_protocol, analysis_run, manuscript)
- artifact_id: TEXT
- agent_type: TEXT (irb, analysis, manuscript)
- title: TEXT (nullable)
- created_by: UUID
- created_at, updated_at: TIMESTAMPTZ

### chat_messages
- id: UUID (PK)
- session_id: UUID (FK → chat_sessions)
- role: TEXT (system, user, assistant)
- author_id: UUID (nullable)
- content: TEXT
- metadata: JSONB
- phi_detected: BOOLEAN
- created_at: TIMESTAMPTZ

### chat_actions
- id: UUID (PK)
- message_id: UUID (FK → chat_messages)
- action_type: TEXT (patch, replace_section, append, insert_table, etc.)
- status: TEXT (proposed, approved, executed, failed, rejected)
- payload: JSONB
- result: JSONB
- created_at, executed_at: TIMESTAMPTZ

## Governance Rules
| Mode | PHI Detected | Behavior |
|------|--------------|----------|
| DEMO | Yes | Warn but allow LLM call |
| DEMO | No | Allow |
| LIVE | Yes | Block LLM call, return error |
| LIVE | No | Allow |

## Action Types
- `patch`: JSON Patch for structured document edits
- `replace_section`: Replace specific manuscript section
- `append`: Add content to end of document
- `insert_table`: Insert formatted table
- `update_methods`: Update analysis methods section
- `add_citation`: Add citation to references

## Frontend Integration
ChatAgentPanel component accepts:
- agentType: 'irb' | 'analysis' | 'manuscript'
- artifactType: string
- artifactId: string
- getClientContext: () => object (provides current document state)

## Environment Variables
- CHAT_AGENT_MODEL: LLM model (default: gpt-4)
- OPENAI_API_KEY: OpenAI API key
- ANTHROPIC_API_KEY: Anthropic API key
- GOVERNANCE_MODE: DEMO | LIVE
- PHI_SCAN_ENABLED: true | false
- NEXT_PUBLIC_ENABLE_CHAT_AGENTS: true | false
