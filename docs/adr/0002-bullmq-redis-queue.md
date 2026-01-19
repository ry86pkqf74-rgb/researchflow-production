# ADR 0002: BullMQ + Redis for Job Queue

## Status

Accepted

## Context

ResearchFlow needs reliable job queuing for:
- Long-running analysis jobs (minutes to hours)
- Job prioritization and scheduling
- Failure handling and retry logic
- Progress tracking and status updates
- Scalable worker distribution

Options considered:
1. **RabbitMQ**: Full AMQP broker, more features, more operational overhead
2. **Redis + BullMQ**: Simple, Redis-based, TypeScript-native, excellent Node.js integration
3. **AWS SQS/GCP Pub/Sub**: Cloud-native, but vendor lock-in
4. **PostgreSQL LISTEN/NOTIFY**: Already have Postgres, but limited queue semantics

## Decision

Use **BullMQ** with **Redis** for job queuing.

Rationale:
- TypeScript-native with excellent type safety
- Redis is already needed for caching
- Built-in support for job progress, priorities, delays
- Reliable with Redis persistence (AOF)
- Dashboard available (Bull Board) for debugging
- Active community and maintenance

## Consequences

### Positive
- Single data store (Redis) for queue + cache
- TypeScript types for job definitions
- Built-in retry with exponential backoff
- Job progress tracking for UI updates
- Simple deployment (Redis is familiar)

### Negative
- Redis single-point-of-failure (mitigated by persistence)
- Not designed for millions of messages/second (acceptable for our scale)
- Less sophisticated routing than RabbitMQ

### Configuration

```typescript
// Queue configuration
const queue = new Queue('research-jobs', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400 },  // 24 hours
    removeOnFail: { age: 604800 },     // 7 days
  },
});
```

### Future Considerations
- Consider Redis Cluster for high availability
- Evaluate RabbitMQ if routing complexity increases
- Monitor queue depth for autoscaling decisions
