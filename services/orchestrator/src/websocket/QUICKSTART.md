# WebSocket Event System - Quick Start Guide

Get up and running with real-time research run events in 5 minutes.

## 1. Frontend: Show Run Progress

```typescript
// pages/runs/[runId].tsx
import { useRunEvents } from '@/hooks/useRunEvents';
import { useEffect, useState } from 'react';

export default function RunPage({ runId }) {
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(null);

  const { isConnected, subscribe, subscribe_category } = useRunEvents({
    runId,
    userId: currentUser.id,
  });

  useEffect(() => {
    // Listen for stage progress updates
    const unsub = subscribe_category('STAGE_EVENTS', (event) => {
      if (event.type === 'stage.started') {
        setCurrentStage(event.payload.stageName);
      } else if (event.type === 'stage.progress') {
        setProgress(event.payload.progress);
      } else if (event.type === 'stage.completed') {
        setProgress(100);
      }
    });

    return unsub;
  }, [subscribe_category, runId]);

  return (
    <div>
      <h1>Run: {runId}</h1>
      <p>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      {currentStage && <p>Current Stage: {currentStage}</p>}
      <progress value={progress} max={100}></progress>
      <span>{progress}%</span>
    </div>
  );
}
```

## 2. Backend: Emit Events

```typescript
// routes/runs.ts
import express from 'express';
import { runEventBroadcaster } from '@/websocket/broadcaster';

const router = express.Router();

router.post('/:runId/start', async (req, res) => {
  const run = await Run.findById(req.params.runId);

  // Emit event
  runEventBroadcaster.broadcastRunStarted({
    runId: run.id,
    projectId: run.projectId,
  });

  res.json(run);
});

router.post('/:runId/stages/:stageId/progress', async (req, res) => {
  const { progress } = req.body;

  runEventBroadcaster.broadcastStageProgress({
    runId: req.params.runId,
    stageId: req.params.stageId,
    stageName: 'Data Ingestion',
    progress,
  });

  res.json({ ok: true });
});

export default router;
```

## 3. Test Connection

```bash
# Terminal 1: Start server
cd services/orchestrator
npm run dev

# Terminal 2: Test WebSocket
# Open browser console and run:
const ws = new WebSocket('ws://localhost:3001/ws');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.send(JSON.stringify({ type: 'ping' }));
# Should see: { type: 'pong', timestamp: '...', payload: {} }
```

## 4. Event Types

### Run Lifecycle

```typescript
// Run created
runEventBroadcaster.broadcastRunCreated({
  runId: 'run-123',
  projectId: 'proj-456',
  runName: 'My Analysis',
  stageCount: 3,
  createdBy: 'user-789',
});

// Run started
runEventBroadcaster.broadcastRunStarted({
  runId: 'run-123',
  projectId: 'proj-456',
});

// Run completed
runEventBroadcaster.broadcastRunCompleted({
  runId: 'run-123',
  projectId: 'proj-456',
  durationMs: 300000,
  stagesCompleted: 3,
});

// Run failed
runEventBroadcaster.broadcastRunFailed({
  runId: 'run-123',
  projectId: 'proj-456',
  errorCode: 'STAGE_TIMEOUT',
});
```

### Stage Lifecycle

```typescript
// Stage started
runEventBroadcaster.broadcastStageStarted({
  runId: 'run-123',
  stageId: 'stage-1',
  stageName: 'Data Ingestion',
  stageNumber: 1,
  totalStages: 3,
});

// Stage progress (emit frequently)
runEventBroadcaster.broadcastStageProgress({
  runId: 'run-123',
  stageId: 'stage-1',
  stageName: 'Data Ingestion',
  progress: 45,
  statusMessage: 'Processing 450 of 1000 rows',
  itemsProcessed: 450,
  itemsTotal: 1000,
});

// Stage completed
runEventBroadcaster.broadcastStageCompleted({
  runId: 'run-123',
  stageId: 'stage-1',
  stageName: 'Data Ingestion',
  stageNumber: 1,
  durationMs: 120000,
});

// Stage failed
runEventBroadcaster.broadcastStageFailed({
  runId: 'run-123',
  stageId: 'stage-1',
  stageName: 'Data Ingestion',
  stageNumber: 1,
  errorCode: 'PARSE_ERROR',
  retriesRemaining: 2,
});
```

### Governance

```typescript
// Approval required
runEventBroadcaster.broadcastGovernanceRequired({
  runId: 'run-123',
  governanceId: 'gov-789',
  governanceType: 'PHI_SCAN',
  priority: 'HIGH',
  assignedTo: ['admin@example.com'],
});

// Approval granted
runEventBroadcaster.broadcastApprovalGranted({
  runId: 'run-123',
  approvalId: 'app-999',
  governanceId: 'gov-789',
  governanceType: 'PHI_SCAN',
  grantedBy: 'admin@example.com',
});

// Approval denied
runEventBroadcaster.broadcastApprovalDenied({
  runId: 'run-123',
  approvalId: 'app-999',
  governanceId: 'gov-789',
  governanceType: 'PHI_SCAN',
  deniedBy: 'admin@example.com',
  reason: 'PHI detected in stage output',
  canRetry: true,
});
```

## 5. Hook Usage

```typescript
// Basic usage
const { isConnected, subscribe } = useRunEvents({
  runId: 'run-123',
  userId: 'user-456',
});

// Subscribe to specific event
useEffect(() => {
  const unsub = subscribe('run.completed', (event) => {
    console.log('Run finished!');
    // Update UI
  });
  return unsub;
}, [subscribe]);

// Subscribe to event category
useEffect(() => {
  const unsub = subscribe_category('STAGE_EVENTS', (event) => {
    // Handle any stage event
    if (event.type === 'stage.progress') {
      updateProgressBar(event.payload.progress);
    }
  });
  return unsub;
}, [subscribe_category]);

// Manual control
const { reconnect, disconnect } = useRunEvents({ /* ... */ });

// Reconnect after network error
if (error) {
  setTimeout(() => reconnect(), 5000);
}

// Cleanup
return () => disconnect();
```

## 6. Common Patterns

### Progress Bar

```typescript
export function RunProgress({ runId }) {
  const [progress, setProgress] = useState(0);
  const { subscribe } = useRunEvents({ runId });

  useEffect(() => {
    const unsub = subscribe('stage.progress', (event) => {
      setProgress(event.payload.progress);
    });
    return unsub;
  }, [subscribe]);

  return (
    <div className="progress">
      <div className="bar" style={{ width: `${progress}%` }}></div>
      <span>{progress}%</span>
    </div>
  );
}
```

### Status Badge

```typescript
export function RunStatus({ runId }) {
  const [status, setStatus] = useState('idle');
  const { subscribe } = useRunEvents({ runId });

  useEffect(() => {
    subscribe('run.started', () => setStatus('running'));
    subscribe('run.completed', () => setStatus('completed'));
    subscribe('run.failed', () => setStatus('failed'));

    return () => {
      // Cleanup happens automatically
    };
  }, [subscribe]);

  return (
    <div className={`status ${status}`}>
      {status.toUpperCase()}
    </div>
  );
}
```

### Event Log

```typescript
export function EventLog({ runId }) {
  const [events, setEvents] = useState([]);
  const { subscribe_category } = useRunEvents({ runId });

  useEffect(() => {
    const unsub = subscribe_category('ALL_EVENTS', (event) => {
      setEvents((prev) => [
        ...prev,
        {
          timestamp: event.timestamp,
          type: event.type,
          payload: event.payload,
        },
      ]);
    });
    return unsub;
  }, [subscribe_category]);

  return (
    <div className="event-log">
      {events.map((e, i) => (
        <div key={i} className="event">
          <time>{new Date(e.timestamp).toLocaleTimeString()}</time>
          <strong>{e.type}</strong>
          <pre>{JSON.stringify(e.payload, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}
```

### Real-time Notifications

```typescript
export function RunNotifications({ runId, userId }) {
  const { subscribe } = useRunEvents({ runId, userId });

  useEffect(() => {
    // Notify on completion
    subscribe('run.completed', (event) => {
      sendNotification({
        title: 'Run Completed',
        body: `Run ${runId} finished successfully!`,
        icon: '✅',
      });
    });

    // Notify on failure
    subscribe('run.failed', (event) => {
      sendNotification({
        title: 'Run Failed',
        body: `Run ${runId} encountered error: ${event.payload.errorCode}`,
        icon: '❌',
      });
    });

    // Notify on approval required
    subscribe('governance.required', (event) => {
      sendNotification({
        title: 'Approval Required',
        body: `${event.payload.governanceType} approval required for run ${runId}`,
        icon: '⏸️',
      });
    });
  }, [subscribe, runId]);

  return null;
}
```

## 7. Debugging

Enable debug logging:

```typescript
// In browser console
localStorage.setItem('debug', 'websocket:*');
location.reload();

// Or in code
const { connectionState, error, isConnected } = useRunEvents({
  onError: (err) => console.error('WebSocket error:', err),
  // ... other options
});

useEffect(() => {
  console.log('Connection state:', connectionState);
}, [connectionState]);
```

## 8. Deployment Checklist

- [ ] Server running with WebSocketManager initialized
- [ ] `/ws` endpoint accessible from frontend
- [ ] CORS allows WebSocket origin
- [ ] Frontend has `REACT_APP_WEBSOCKET_URL` set (or uses default)
- [ ] Events being published from route handlers
- [ ] Test WebSocket connection in browser dev tools
- [ ] Monitor server logs for WebSocket errors
- [ ] Set up alerts for disconnection spikes

## 9. Performance Tips

1. **Throttle Progress Events**
   ```typescript
   // Don't emit stage.progress on every item
   // Instead, batch and emit every 100 items or 500ms
   ```

2. **Unsubscribe Unused Events**
   ```typescript
   // Bad: subscribes to every event
   const unsub = subscribe('all', handler);

   // Good: subscribe to specific events
   const unsub = subscribe('stage.progress', handler);
   ```

3. **Use Categories**
   ```typescript
   // Instead of subscribing to many individual events
   const unsub = subscribe_category('STAGE_EVENTS', handler);
   ```

4. **Clean Up on Unmount**
   ```typescript
   useEffect(() => {
     const unsub = subscribe('event', handler);
     return unsub;  // IMPORTANT!
   }, [subscribe]);
   ```

## 10. Troubleshooting

### WebSocket connection fails
```typescript
const { error, connectionState, reconnect } = useRunEvents();

useEffect(() => {
  if (connectionState === 'ERROR') {
    console.error('Connection error:', error);
    // Retry after 5 seconds
    setTimeout(reconnect, 5000);
  }
}, [connectionState, error, reconnect]);
```

### Events not received
```typescript
const { isConnected, subscribe } = useRunEvents({
  userId: currentUser.id,  // Make sure to authenticate
});

// Subscribe AFTER connection established
useEffect(() => {
  if (!isConnected) return;

  const unsub = subscribe('run.started', handler);
  return unsub;
}, [isConnected, subscribe]);
```

### Memory leaks
```typescript
// Always return cleanup function
useEffect(() => {
  const unsub = subscribe('event', handler);
  return unsub;  // This is critical!
}, [subscribe]);
```

## Next Steps

1. Create dashboard components using WebSocket events
2. Add error boundary for connection failures
3. Implement reconnection UI feedback
4. Add WebSocket metrics to monitoring dashboard
5. Test with multiple concurrent users

See [README.md](./README.md) for comprehensive documentation.
