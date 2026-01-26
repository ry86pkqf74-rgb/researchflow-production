# Migration Discipline Guide

## Overview

ResearchFlow uses PostgreSQL with Drizzle ORM. Migrations are SQL files in `/migrations/` that modify the database schema.

## Naming Convention

```
NNNN_phase_X_description.sql
```

- `NNNN`: Zero-padded sequence number (0000, 0001, etc.)
- `phase_X`: Phase identifier (a-z or descriptive name)
- `description`: Brief snake_case description

Examples:
- `0004_phase_d_ethics_security.sql`
- `0005_phase_e_multitenancy.sql`
- `0006_phase_f_schema_alignment.sql`

## Current Migrations

| File | Description |
|------|-------------|
| `0000_omniscient_emma_frost.sql` | Initial schema (users, sessions, core tables) |
| `0002_ai_integration.sql` | AI invocations, prompts, batching |
| `003_create_manuscript_tables.sql` | Manuscript engine tables |
| `0004_phase_d_ethics_security.sql` | Ethics, consent, MFA, quotas |
| `0005_phase_e_multitenancy.sql` | Organizations, memberships, integrations |
| `0006_phase_f_schema_alignment.sql` | Schema alignment (briefs, docs, features) |

## Writing Migrations

### Required Patterns

1. **Idempotent operations**: Use `IF NOT EXISTS` / `IF EXISTS`
```sql
CREATE TABLE IF NOT EXISTS my_table (...);
CREATE INDEX IF NOT EXISTS idx_my_table_col ON my_table(col);
ALTER TABLE my_table ADD COLUMN IF NOT EXISTS new_col TEXT;
```

2. **Safe column additions with DO blocks**:
```sql
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'my_table' AND column_name = 'new_col'
  ) THEN
    ALTER TABLE my_table ADD COLUMN new_col TEXT;
  END IF;
END $$;
```

3. **Foreign key references**: Always use `REFERENCES` with `ON DELETE` action
```sql
user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE
```

### Running Migrations

**Development (Docker)**:
```bash
# Run the migration runner (tracks applied versions)
make db-migrate

# Migrations run automatically on container start
docker compose down && docker compose up -d --build
```

**Manual execution**:
```bash
# Connect to database
docker compose exec postgres psql -U ros -d ros

# Run migration
\i /migrations/0006_phase_f_schema_alignment.sql

# Bootstrap-only (init.sql) if you need a clean base schema
make db-init
```

**Via npm script** (if available):
```bash
npm run db:migrate
```

## Keeping init.sql Aligned

If `infrastructure/docker/postgres/init.sql` exists and is used for dev bootstrap:

1. Add new tables/indexes from your migration
2. Keep the same order as migrations
3. Include seed data if applicable

## Schema Synchronization

The Drizzle schema in `packages/core/types/schema.ts` must match the database:

1. Add new tables to `schema.ts` with matching column names
2. Export insert schemas and types
3. Run `npm run typecheck` to verify

### Naming Convention (Drizzle ↔ SQL)

| Drizzle (camelCase) | SQL (snake_case) |
|---------------------|------------------|
| `createdAt` | `created_at` |
| `orgId` | `org_id` |
| `userId` | `user_id` |

## Troubleshooting

### TypeCheck errors after adding tables

1. Ensure migration has been run
2. Verify table/column names match exactly
3. Check foreign key references exist

### Migration fails

1. Check for existing objects (tables, indexes)
2. Use `IF NOT EXISTS` patterns
3. Check foreign key targets exist

## Testing Migrations

Before pushing:

1. `docker compose down -v` (remove volumes)
2. `docker compose up -d --build`
3. Check all services start successfully
4. Run `npm run typecheck`
