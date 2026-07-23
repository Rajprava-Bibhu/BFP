#!/usr/bin/env bash
# =============================================================
# BFP — Database Setup Script
# Creates the database schema and seeds demo data.
# Run from project root: bash scripts/db-setup.sh
# =============================================================
set -e

echo ""
echo "================================================"
echo "  BFP — Database Setup"
echo "================================================"
echo ""

if [ -z "$DATABASE_URL" ]; then
  if [ -f .env ]; then
    set -a; source .env; set +a
  fi
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Set it in .env or export it before running this script."
  exit 1
fi

echo "→ Pushing schema to database..."
pnpm --filter @workspace/db run push

echo "→ Seeding demo data..."
pnpm --filter @workspace/scripts run seed

echo ""
echo "✓ Database ready!"
echo ""
echo "Demo accounts:"
echo "  super_admin  → admin@demo.com      / password"
echo "  org_admin    → orgadmin@demo.com   / password"
echo "  dept_head    → depthead@demo.com   / password"
echo "  employee     → employee@demo.com   / password"
echo ""
