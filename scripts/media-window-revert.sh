#!/usr/bin/env bash
# ONE-SHOT: revert ThinkStack Media's activity_window to normal (16-20) after tonight's
# ad-hoc sprint, then self-remove. (Superseded by the general ad-hoc-sprint runbook later.)
LOG=/Users/glad0s/paperclip/.devlogs/media-window-revert.log
~/.claude/board-api.sh PATCH /companies/d71c9e82-1a4b-497f-9bbc-5b9dd028c367/activity-window \
  '{"window":{"startHour":16,"endHour":20,"timezone":"Europe/Dublin","sessionPurgeOnClose":true}}' >> "$LOG" 2>&1
echo " <- Media window reverted to 16-20 at $(date)" >> "$LOG"
launchctl unload ~/Library/LaunchAgents/com.thinkstack.media-window-revert.plist 2>/dev/null
rm -f ~/Library/LaunchAgents/com.thinkstack.media-window-revert.plist
