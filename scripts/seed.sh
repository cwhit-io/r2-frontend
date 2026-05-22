#!/usr/bin/env bash
set -euo pipefail
wrangler d1 execute r2-frontend --local --file=./db/seed.sql
