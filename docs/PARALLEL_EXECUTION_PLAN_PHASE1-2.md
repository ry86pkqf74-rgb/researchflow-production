# ResearchFlow Phase 1-2 Parallel Execution Plan
## Generated: 2026-01-28 | Status: ACTIVE

---

## Execution Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PARALLEL EXECUTION STREAMS                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STREAM A (Claude Code)          STREAM B (Coworker Orchestration)          │
│  ━━━━━━━━━━━━━━━━━━━━━━          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          │
│  Sequential Implementation        Parallel AI Tool Dispatch                 │
│                                                                             │
│  [1.2.1] Redis Bus ──────────┬──▶ [GPT-4] Schema validation                │
│           │                  ├──▶ [Grok] Security review                    │
│           │                  └──▶ [Mercury] Type generation                 │
│           ▼                                                                 │
│  [1.3.1] DB Tables ──────────┬──▶ [GPT-4] Index optimization               │
│           │                  └──▶ [Grok] Migration testing                  │
│           ▼                                                                 │
│  [2.1.1] Insights Worker ────┬──▶ [Replit] Consumer stress test            │
│           │                  ├──▶ [Mercury] Report templates               │
│           │                  └──▶ [Grok] Pytest fixtures                   │
│           ▼                                                                 │
│  [2.2.1] Report Generator ───┬──▶ [Cursor] UI components                   │
│                              └──▶ [Figma] Design tokens                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## PHASE 1: Foundation (Current)

### ✅ Task 1.1.1 - AI Invocation Trace Contract [COMPLETE]
**Agent:** Claude Code  
**Commit:** `5bc2c6b` - `[ROS-TRACE-01]`  
**Files Created:**
- `shared/schemas/ai_invocation_event.schema.json`
- `packages/core/src/events/aiInvocation.ts`
- `packages/ai-router/src/middleware/traceEmitter.ts`

---

### 🔄 Task 1.2.1 - Redis Insights Bus Setup [IN PROGRESS]
**Agent:** Claude Code (Primary)  
**Parallel Agents:**

| Agent | Task | Output |
|-------|------|--------|
| **GPT-4** | Generate Redis Stream consumer group configuration with optimal settings for healthcare audit trails | `redis-config.json` |
| **Grok** | Security audit of Redis Stream patterns for PHI compliance | `REDIS_SECURITY_AUDIT.md` |
| **Mercury** | Generate TypeScript Redis wrapper with full type safety | `redisStreamClient.ts` |

**Files to Create:**
```
packages/core/src/services/insightsBus.ts      # Redis Streams client
services/orchestrator/src/config/redis.ts      # Environment config
infrastructure/docker/docker-compose.yml       # Update Redis config
```

**Acceptance Criteria:**
- [ ] `redis-cli XREAD STREAMS ros:insights 0` returns events
- [ ] Consumer group `ros:insights-workers` created
- [ ] Graceful degradation tested (Redis down scenario)
- [ ] Health check endpoint returns stream status

---

### 📋 Task 1.3.1 - Database Schema Extensions [QUEUED]
**Agent:** Claude Code (Primary)  
**Parallel Agents:**

| Agent | Task | Output |
|-------|------|--------|
| **GPT-4** | Optimize index strategy for ai_invocations queries (by run, by time, by tier) | Index recommendations |
| **Grok** | Generate migration rollback scripts and test fixtures | `rollback_transparency.sql` |
| **Context7** | Fetch Prisma best practices for JSONB columns | Documentation |

**Migration Tables:**
1. `ai_invocations` - Enhanced with governance_mode, phi_scan_summary JSONB
2. `datasets` - Large data handles with partition tracking
3. `dataset_access_log` - Audit trail for data access
4. `workflow_stage_runs` - Checkpointing support

---

## PHASE 2: Insights Worker

### 📋 Task 2.1.1 - Insights Worker Service Scaffold [QUEUED]
**Agent:** Claude Code (Primary)  
**Parallel Agents:**

| Agent | Task | Output |
|-------|------|--------|
| **GPT-4** | Design transparency_report JSON schema with all aggregation fields | `transparency_report.schema.json` |
| **Grok** | Create pytest test plan for Redis consumer edge cases (duplicates, out-of-order, failures) | `test_consumer.py` |
| **Mercury** | Generate Jinja2 markdown report template with ResearchFlow branding | `transparency_report.md.j2` |
| **Replit** | Build stress test harness for consumer with 10k events/min | `stress_test_consumer.py` |

**Service Structure:**
```
services/insights-worker/
├── Dockerfile
├── requirements.txt
├── src/
│   ├── main.py              # FastAPI app
│   ├── config.py            # Environment config
│   ├── consumer.py          # Redis Stream XREADGROUP consumer
│   ├── processors/
│   │   ├── trace_aggregator.py
│   │   ├── stability_tester.py
│   │   └── slice_analyzer.py
│   └── artifacts/
│       ├── writer.py
│       └── lit_bundle.py
└── tests/
```

---

### 📋 Task 2.2.1 - Transparency Report Generator [QUEUED]
**Agent:** Claude Code (Primary)  
**Parallel Agents:**

| Agent | Task | Output |
|-------|------|--------|
| **Cursor** | Create React TransparencyPanel component with cost breakdown charts | `TransparencyPanel.tsx` |
| **Figma MCP** | Extract design tokens for report styling (colors, typography) | Design spec |
| **Mercury** | Generate PDF export template with HIPAA-compliant headers | `report_pdf.py` |
| **Grok** | Create E2E test for report generation flow | `test_report_e2e.py` |

---

### 📋 Task 2.3.1 - LIT Bundle Generator [QUEUED]
**Agent:** Claude Code (Primary)  
**Parallel Agents:**

| Agent | Task | Output |
|-------|------|--------|
| **GPT-4** | Design LIT-compatible dataset schema for AI traces | `lit_schema.json` |
| **Mercury** | Generate demo.py script for local LIT server | `lit_demo.py` |
| **Replit** | Create integration test with actual LIT server | `test_lit_integration.py` |

---

## Parallel Execution Schedule

### Day 1 (Today)
| Time | Claude Code | GPT-4 | Grok | Mercury | Replit |
|------|-------------|-------|------|---------|--------|
| Now | 1.2.1 Redis Bus | Redis config | Redis security | Redis types | - |
| +2h | 1.3.1 DB Tables | Index strategy | Migration tests | - | - |
| +4h | 2.1.1 Worker | Report schema | Consumer tests | Report template | Stress test |

### Day 2
| Time | Claude Code | GPT-4 | Grok | Mercury | Cursor |
|------|-------------|-------|------|---------|--------|
| AM | 2.2.1 Reports | - | E2E tests | PDF export | UI Panel |
| PM | 2.3.1 LIT | LIT schema | - | LIT demo | - |

---

## Agent Dispatch Prompts

### GPT-4: Redis Stream Configuration
```
Generate a production-ready Redis Stream configuration for a healthcare AI transparency system.

Requirements:
- Stream name: ros:insights
- Consumer group: ros:insights-workers
- Max stream length: 100,000 entries (with approximate trimming)
- Retention: 30 days
- PHI compliance: No raw PHI in stream, only hashes and references

Output JSON configuration with:
1. XGROUP CREATE command
2. Consumer settings (block time, count, ACK strategy)
3. Memory limits
4. Persistence settings for AOF
5. Recommended replica configuration
```

### Grok: Redis Security Audit
```
Audit this Redis Stream design for HIPAA compliance and security:

Stream: ros:insights
Purpose: AI invocation transparency tracking for clinical research platform
Data: Invocation metadata (no raw PHI - only references and hashes)

Check for:
1. Data at rest encryption requirements
2. Network security (TLS)
3. Access control (ACL)
4. Audit logging of stream access
5. Data retention compliance
6. Backup/recovery procedures
7. Consumer authentication

Output: Security audit report with findings and recommendations
```

### Mercury: TypeScript Redis Wrapper
```
Generate a TypeScript Redis Streams wrapper for ResearchFlow with:

Interface InsightsBus:
- publish(event: AIInvocationEvent): Promise<string>
- consume(handler: (event: AIInvocationEvent) => Promise<void>): void
- replay(fromId: string): AsyncIterator<AIInvocationEvent>
- getStreamInfo(): Promise<StreamInfo>
- createConsumerGroup(name: string): Promise<void>

Requirements:
- Use ioredis
- Full type safety
- Graceful degradation if Redis unavailable
- Connection pooling
- Automatic reconnection
- Metrics hooks (onPublish, onConsume, onError)
```

---

## Linear Issue Updates

After each task completion, update Linear:

```bash
# Task 1.2.1 completion
Linear:update_issue id="ROS-TRACE-02" state="Done" \
  description="Redis insights bus configured. Stream ros:insights operational."

# Task 1.3.1 completion  
Linear:update_issue id="ROS-TRACE-03" state="Done" \
  description="Transparency tables migrated. 4 new tables added."
```

---

## Commit Strategy

```bash
# After each task
git add -A
git commit -m "[ROS-TRACE-0X] Description

- Bullet point 1
- Bullet point 2

Co-authored-by: GPT-4 <gpt4@openai.com>
Co-authored-by: Grok <grok@x.ai>"
git push origin main
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Event Latency | <50ms | Time from AI call to stream entry |
| Consumer Throughput | 1000 events/sec | Stress test benchmark |
| Report Generation | <5s | Time to generate transparency report |
| PHI Leak Detection | 0 incidents | Automated scanning in CI |
| Test Coverage | >80% | Jest + Pytest combined |

---

## Risk Mitigation

| Risk | Mitigation | Owner |
|------|------------|-------|
| Redis unavailable | Graceful degradation, local queue fallback | Claude Code |
| PHI in traces | Pre-emit scanning, hash-only storage | Grok audit |
| Schema evolution | Version field, backward compatibility | GPT-4 |
| Consumer lag | Backpressure handling, alerting | Replit stress test |

