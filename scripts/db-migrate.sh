#!/usr/bin/env bash
# =============================================================
# BizAuto — Database Migration Script
# Runs Drizzle schema push against the target DATABASE_URL
#
# Usage:
#   DATABASE_URL=postgresql://... ./scripts/db-migrate.sh
#   (or set DATABASE_URL in your shell / .env)
# =============================================================

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL is required"
  exit 1
fi

echo "▶ Running database migrations..."
echo "  Target: ${DATABASE_URL%%@*}@***"

cd "$(dirname "$0")/.."

# Use drizzle-kit push to sync the schema
pnpm --filter @workspace/db run push

echo "✅ Database migrations complete"
