# Webhooks Runbook

## Overview

ResearchFlow supports incoming webhooks from external services (Stripe, Zoom) with signature verification and audit logging.

## Prerequisites

- Node.js 20+
- Webhook secrets configured
- Orchestrator service running

## Environment Variables

```bash
# Stripe
STRIPE_WEBHOOK_SECRET=whsec_...

# Zoom
ZOOM_WEBHOOK_SECRET_TOKEN=your_zoom_secret
ZOOM_VERIFICATION_TOKEN=your_verification_token
```

## Supported Webhooks

### Stripe

Handles payment and subscription events.

**Endpoint**: `POST /api/webhooks/stripe`

**Events handled**:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

### Zoom

Handles meeting and recording events.

**Endpoint**: `POST /api/webhooks/zoom`

**Events handled**:
- `endpoint.url_validation` (Zoom verification)
- `meeting.started`
- `meeting.ended`
- `recording.completed`
- `recording.transcript_completed`
- `meeting.participant_joined`
- `meeting.participant_left`

## Security

### Signature Verification

All webhooks verify signatures before processing:

**Stripe**: HMAC-SHA256 with timestamp tolerance (5 minutes)
```
Stripe-Signature: t=timestamp,v1=signature
```

**Zoom**: HMAC-SHA256 with versioned signatures
```
x-zm-signature: v0=hash
x-zm-request-timestamp: timestamp
```

### Audit Logging

Every webhook event is logged:
- Valid signatures: `webhook.{provider}.{event_type}` SUCCESS
- Invalid signatures: `webhook.{provider}.invalid_signature` FAILURE
- Processing errors: `webhook.{provider}.{event_type}.error` FAILURE

## How to Set Up

### Stripe

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events to listen for
4. Copy signing secret to `STRIPE_WEBHOOK_SECRET`

### Zoom

1. Go to Zoom Marketplace → Build App → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/zoom`
3. Copy secret token to `ZOOM_WEBHOOK_SECRET_TOKEN`
4. Zoom will verify the endpoint automatically

## Testing Locally

### Using ngrok

```bash
# Expose local server
ngrok http 3001

# Use ngrok URL in webhook configuration
# https://abc123.ngrok.io/api/webhooks/stripe
```

### Stripe CLI

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Listen for webhooks
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
```

### Manual Testing

```bash
# Check webhook health
curl http://localhost:3001/api/webhooks/health

# Response:
# {
#   "ok": true,
#   "webhooks": {
#     "stripe": true,
#     "zoom": false
#   },
#   "timestamp": "2024-01-20T..."
# }
```

## Troubleshooting

### "Invalid signature"

1. Verify secret is correct
2. Check timestamp tolerance (Stripe: 5 minutes)
3. Ensure raw body is preserved for Stripe

### "Missing webhook secret"

1. Add environment variable
2. Restart orchestrator
3. Check health endpoint

### "Processing error"

1. Check application logs
2. Verify database connectivity
3. Review audit logs

## Implementation Details

### File Locations

```
services/orchestrator/src/
├── webhooks/
│   ├── index.ts        # Exports
│   ├── stripe.ts       # Stripe handler
│   └── zoom.ts         # Zoom handler
└── routes/
    └── webhooks.ts     # Route registration
```

### Adding New Webhooks

1. Create handler in `webhooks/`
2. Implement signature verification
3. Add audit logging
4. Export from `webhooks/index.ts`
5. Register route in `routes/webhooks.ts`

## PHI Considerations

**Zoom Transcripts**: Must be PHI-scanned before storage. Meeting recordings may contain sensitive patient information.

**Stripe**: Payment data should not contain PHI, but metadata fields are scanned defensively.

## Related Documentation

- [services/orchestrator/src/webhooks/](../../services/orchestrator/src/webhooks/) - Implementation
- [services/orchestrator/src/routes/webhooks.ts](../../services/orchestrator/src/routes/webhooks.ts) - Routes
- [docs/audit/SERVICE_INVENTORY.md](../audit/SERVICE_INVENTORY.md) - Service inventory
