#!/bin/sh
set -eu
cd /workspace
# :8081 is QA-only — a revive must never inherit a stale built-output preview.
node scripts/preview.mjs stop || true
if ! curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  npm run dev >>/tmp/app-startup.log 2>&1 &
  i=0
  while [ "$i" -lt 40 ]; do
    if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
      break
    fi
    i=$((i + 1))
    sleep 0.5
  done
fi
# Warm the live scrape in the app process. Do not block revive on tracker latency.
curl -sf --max-time 90 "http://127.0.0.1:8080/api/ingest" >/tmp/ingest-kick.log 2>&1 &
exit 0
