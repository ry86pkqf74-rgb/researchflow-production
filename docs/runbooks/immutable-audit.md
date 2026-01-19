# Immutable Audit Runbook

This document describes the immutable audit system that anchors critical events to a distributed ledger for tamper-proof compliance tracking.

## Overview

The immutable audit system follows a two-phase pattern:

1. **Phase 1 (Immediate)**: Write audit event to PostgreSQL database
2. **Phase 2 (Async)**: Anchor event hash to Hyperledger Fabric ledger

This ensures:
- User requests are never blocked by ledger operations
- Audit events are immediately queryable in the database
- Ledger provides cryptographic proof of audit integrity

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Service   │────▶│   Database   │────▶│ Ledger Writer   │
│   Action    │     │  (Primary)   │     │    (Async)      │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                                         ┌─────────▼─────────┐
                                         │   Hyperledger     │
                                         │     Fabric        │
                                         └───────────────────┘
```

## Critical Rules

### PHI Handling

**CRITICAL**: The ledger MUST NEVER contain PHI. Only the following are stored:

| Stored | NOT Stored |
|--------|------------|
| Hashes of user IDs | Actual user IDs |
| Hashes of resource IDs | Actual resource IDs |
| Hashes of action details | Raw action details |
| Event types | Payload content |
| Timestamps | PHI values |

### Non-Blocking Operations

**CRITICAL**: Ledger writes are ALWAYS asynchronous. Never block user requests.

```typescript
// CORRECT: Async submission
const entryId = await queueAuditForLedger(eventType, actorId, resourceId, details);
// Returns immediately, ledger write happens in background

// WRONG: Do not await ledger submission in request path
await service.submitEntry(entry); // Never do this in request handlers
```

## Event Types

| Event Type | Description | When Triggered |
|------------|-------------|----------------|
| `DATA_UPLOAD` | Dataset uploaded | File upload completes |
| `DATA_CLASSIFICATION` | Data classification changed | Classification updated |
| `PHI_SCAN` | PHI scan performed | Scan completes |
| `PHI_REVEAL` | PHI revealed to user | User views PHI |
| `APPROVAL_GRANTED` | Approval given | Supervisor approves |
| `APPROVAL_DENIED` | Approval denied | Supervisor denies |
| `EXPORT_REQUESTED` | Export initiated | User requests export |
| `EXPORT_COMPLETED` | Export finished | Export file created |
| `MANUSCRIPT_GENERATED` | Manuscript created | AI generates text |
| `RESEARCH_CREATED` | New research project | Project initialized |
| `CONFIG_CHANGED` | Configuration updated | Admin changes config |
| `SYSTEM_EVENT` | System-level event | System operations |

## Configuration

### Environment Variables

```bash
# Ledger backend selection (auto-selects mock in development)
NODE_ENV=production

# Hyperledger Fabric configuration
FABRIC_CONNECTION_PROFILE=/path/to/connection-profile.json
FABRIC_CHANNEL=researchflow-audit
FABRIC_CHAINCODE=audit-chaincode

# Fabric identity
FABRIC_WALLET_PATH=/path/to/wallet
FABRIC_IDENTITY=audit-writer

# Optional: MSP configuration
FABRIC_MSP_ID=ResearchFlowMSP
```

### Hyperledger Fabric Setup

1. **Network Prerequisites**
   - Fabric network running (2+ orgs recommended)
   - Channel created for audit events
   - Chaincode deployed

2. **Connection Profile**
   ```json
   {
     "name": "researchflow-network",
     "version": "1.0.0",
     "channels": {
       "researchflow-audit": {
         "orderers": ["orderer.example.com"],
         "peers": {
           "peer0.org1.example.com": {},
           "peer0.org2.example.com": {}
         }
       }
     },
     "organizations": {
       "Org1": {
         "mspid": "Org1MSP",
         "peers": ["peer0.org1.example.com"]
       }
     },
     "peers": {
       "peer0.org1.example.com": {
         "url": "grpcs://peer0.org1.example.com:7051",
         "tlsCACerts": {"path": "/path/to/ca.crt"}
       }
     }
   }
   ```

3. **Chaincode Interface**
   The audit chaincode should implement:
   - `submitAuditEntry(entry)` - Submit new entry
   - `verifyEntry(entryId, transactionId)` - Verify entry exists
   - `getEntryStatus(transactionId)` - Get transaction status

## Verification Procedures

### 1. Verify Ledger Connection

```bash
# Check if Fabric is configured
kubectl exec -it orchestrator-pod -- env | grep FABRIC

# Check ledger service logs
kubectl logs -l app=orchestrator | grep "\[Ledger\]"
```

### 2. Verify Entry Submission

```bash
# Query recent audit events from database
psql -c "SELECT id, event_type, ledger_status, ledger_tx_id FROM audit_log ORDER BY created_at DESC LIMIT 10;"

# Check for PENDING entries (should be rare)
psql -c "SELECT COUNT(*) FROM audit_log WHERE ledger_status = 'PENDING' AND created_at < NOW() - INTERVAL '5 minutes';"
```

### 3. Verify Ledger Consistency

```bash
# Using Fabric CLI
peer chaincode query -C researchflow-audit -n audit-chaincode -c '{"function":"getEntryStatus","Args":["<transactionId>"]}'
```

## Troubleshooting

### Entries Stuck in PENDING

1. Check ledger writer job status:
   ```bash
   kubectl get pods -l app=ledger-writer
   kubectl logs -l app=ledger-writer --tail=100
   ```

2. Check Fabric network connectivity:
   ```bash
   kubectl exec -it ledger-writer-pod -- nc -zv peer0.org1.example.com 7051
   ```

3. Manually retry pending entries:
   ```bash
   # In orchestrator pod
   node -e "require('./dist/jobs/ledger-writer').retryPendingEntries()"
   ```

### Ledger Network Unavailable

1. System continues to work - audit events still written to database
2. Entries remain in PENDING status
3. When network recovers, ledger writer will process backlog

### Entry Verification Failed

1. Check entry exists in database:
   ```bash
   psql -c "SELECT * FROM audit_log WHERE entry_id = '<entryId>';"
   ```

2. Check transaction in Fabric:
   ```bash
   peer chaincode query -C researchflow-audit -n audit-chaincode \
     -c '{"function":"verifyEntry","Args":["<entryId>","<transactionId>"]}'
   ```

## Monitoring

### Key Metrics

- `researchflow_audit_events_total{status}` - Total audit events by status
- `researchflow_ledger_submissions_total{status}` - Ledger submissions
- `researchflow_ledger_latency_seconds` - Time to confirm ledger write
- `researchflow_audit_pending_count` - Current pending entries

### Alerts

1. **HighPendingAuditEntries**
   - Condition: More than 100 entries pending for > 10 minutes
   - Action: Check ledger network connectivity

2. **LedgerSubmissionFailures**
   - Condition: Failure rate > 5%
   - Action: Check Fabric chaincode and network

3. **AuditEventBacklog**
   - Condition: Database audit events growing faster than ledger confirmations
   - Action: Scale ledger writer or check network

## Compliance Notes

1. **Audit Retention**: Ledger entries are immutable and permanent
2. **HIPAA**: PHI is never stored in ledger - only hashes
3. **Verification**: Any audit entry can be independently verified against ledger
4. **Chain Integrity**: Each entry references previous entry hash for tamper detection
