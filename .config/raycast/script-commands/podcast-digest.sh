#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title Podcast Digest
# @raycast.mode compact
# @raycast.packageName Podcasts
# @raycast.icon 🎙️
# @raycast.description Transcribe a podcast episode and turn it into an article
# @raycast.argument1 { "type": "text", "placeholder": "Overcast or audio URL" }
# @raycast.argument2 { "type": "text", "placeholder": "pi model (optional)", "optional": true }

export PATH="$HOME/.local/bin:$HOME/.local/share/mise/shims:/opt/homebrew/bin:$PATH"
config="$HOME/.config/podcast-digest/config"
[ -f "$config" ] && set -a && . "$config" && set +a
[ -n "$2" ] && export PODCAST_DIGEST_LLM_MODEL="$2"

log_dir="$HOME/Library/Logs/podcast-digest"
mkdir -p "$log_dir"
log="$log_dir/$(date +%Y%m%d-%H%M%S).log"

nohup bash -c '
  if article=$(podcast-digest "$1" 2>>"$2"); then
    osascript -e "display notification \"$(basename "$article")\" with title \"Podcast Digest\" subtitle \"Article ready\""
    open "$article"
  else
    osascript -e "display notification \"See $2\" with title \"Podcast Digest\" subtitle \"Failed\""
  fi
' _ "$1" "$log" >/dev/null 2>&1 &
disown

echo "Started, you'll get a notification when the article is ready"
