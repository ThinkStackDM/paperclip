#!/usr/bin/env bash
# Copytruncate rotation for the Paperclip server.log.
#
# The server logs via pino -> pino-pretty -> sonic-boom, which opens the file in
# APPEND mode and holds the fd open for the process lifetime (it never reopens on
# a signal). Rename-based rotation would leave the server writing to the renamed
# (orphaned) inode, so disk is never reclaimed. Copytruncate — snapshot the
# current file, then truncate it in place — is the safe approach for an
# append-mode writer: after truncation the next write lands at offset 0.
#
# Runs from a launchd job (com.thinkstack.server-log-rotate) on an interval; it is
# a no-op until the log crosses the size threshold. Overridable via env.
set -uo pipefail

LOG="${PAPERCLIP_SERVER_LOG:-/Users/glad0s/.paperclip/instances/default/logs/server.log}"
MAX_BYTES="${PAPERCLIP_SERVER_LOG_MAX_BYTES:-209715200}"   # rotate when >= 200 MB
KEEP="${PAPERCLIP_SERVER_LOG_KEEP:-5}"                     # compressed archives to retain

[ -f "$LOG" ] || exit 0
SIZE=$(stat -f%z "$LOG" 2>/dev/null || echo 0)
[ "$SIZE" -lt "$MAX_BYTES" ] && exit 0

# Shift older compressed archives down: .(KEEP-1).gz -> .KEEP.gz, ... .1.gz -> .2.gz
i="$KEEP"
while [ "$i" -gt 1 ]; do
  prev=$((i - 1))
  [ -f "$LOG.$prev.gz" ] && mv -f "$LOG.$prev.gz" "$LOG.$i.gz"
  i="$prev"
done

# Snapshot, then truncate in place (append-mode safe), then compress the snapshot.
cp "$LOG" "$LOG.1" && : > "$LOG"
gzip -f "$LOG.1"

echo "[rotate-server-log $(date '+%F %T')] rotated ${SIZE} bytes -> ${LOG}.1.gz (max=${MAX_BYTES}, keep=${KEEP})"
