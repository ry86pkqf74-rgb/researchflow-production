#!/usr/bin/env bash
set -euo pipefail

MIGRATIONS_DIR=${MIGRATIONS_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/migrations"}
DB_CMD=(docker-compose exec -T postgres psql -U ros -d ros)
DRY_RUN=${DRY_RUN:-0}

# Ensure migrations table exists
"${DB_CMD[@]}" -c "CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());"

# Load applied migrations into a lookup map
applied_raw=$("${DB_CMD[@]}" -At -c "SELECT filename FROM schema_migrations ORDER BY filename;")

# Apply pending migrations in order
files=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort)
if [[ -z "$files" ]]; then
  echo "No migrations found in $MIGRATIONS_DIR"
  exit 0
fi

for file in $files; do
  filename=$(basename "$file")
  if echo "$applied_raw" | grep -Fxq "$filename"; then
    echo "Skipping already applied migration: $filename"
    continue
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "Pending migration: $filename"
    continue
  fi

  echo "Applying migration: $filename"
  cat "$file" | "${DB_CMD[@]}"
  "${DB_CMD[@]}" -c "INSERT INTO schema_migrations (filename) VALUES ('$filename') ON CONFLICT DO NOTHING;"
  echo "Applied: $filename"

done
