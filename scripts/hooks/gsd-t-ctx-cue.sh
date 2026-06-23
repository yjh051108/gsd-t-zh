#!/usr/bin/env bash
# gsd-t-ctx-cue.sh — GSD-T low-context visual cue (M85)
#
# A Stop hook: fires mechanically at the end of EVERY turn. Computes remaining
# context window % from the current session's JSONL (the same source the status
# line uses) and, when it drops below the threshold, prints a STRONG red banner
# so the user knows to checkpoint (/gsd-t-pause) and /clear before compaction.
#
# Deterministic by design — does not rely on the model remembering to check
# (per feedback_deterministic_orchestration). Synchronous (NOT async) so its
# stdout reaches the terminal. Fails silently/open on any error — a status cue
# must never block or break a turn.
#
# Threshold: default 40 (% left). Override with GSD_T_CTX_CUE_THRESHOLD.
# Window: 1,000,000 (Opus 4.7/4.8 + Sonnet 4.x); 200,000 (Haiku).

set -o pipefail
THRESHOLD="${GSD_T_CTX_CUE_THRESHOLD:-40}"

# The hook receives the same JSON on stdin that other hooks do.
input=$(cat 2>/dev/null)

cwd=$(printf '%s' "$input" | jq -r '.workspace.current_dir // .cwd // ""' 2>/dev/null)
[ -z "$cwd" ] && cwd="$PWD"
model=$(printf '%s' "$input" | jq -r '.model.id // ""' 2>/dev/null)

# Only act inside GSD-T projects (a .gsd-t dir present) — the cue is GSD-T's.
[ -d "${cwd}/.gsd-t" ] || exit 0

proj_slug=$(printf '%s' "$cwd" | sed 's:/:-:g')
sess_dir="$HOME/.claude/projects/$proj_slug"
[ -d "$sess_dir" ] || exit 0
latest=$(ls -t "$sess_dir"/*.jsonl 2>/dev/null | head -1)
[ -n "$latest" ] || exit 0

case "$model" in
  *haiku*) win=200000 ;;
  *)       win=1000000 ;;
esac

used=$(grep '"usage"' "$latest" 2>/dev/null | tail -1 \
  | jq -r '(.message.usage // {}) | (.input_tokens//0)+(.cache_creation_input_tokens//0)+(.cache_read_input_tokens//0)' 2>/dev/null)
[ -n "$used" ] && [ "$used" -gt 0 ] 2>/dev/null || exit 0

pct=$(awk -v u="$used" -v w="$win" 'BEGIN { printf "%d", (100 - (u / w * 100)) + 0.5 }')

# Above threshold → silent (no cue).
[ "$pct" -lt "$THRESHOLD" ] 2>/dev/null || exit 0

# ── Strong red banner ──────────────────────────────────────────────────────
RED=$'\033[1;37;41m'   # bold white on red
RST=$'\033[0m'
BAR="████████████████████████████████████████"
printf '\n%s %s %s\n' "$RED" "$BAR" "$RST"
printf '%s  ⚠  CONTEXT LOW — %d%% LEFT %s\n' "$RED" "$pct" "$RST"
printf '%s  Checkpoint now: /gsd-t-pause → /clear → /gsd-t-resume %s\n' "$RED" "$RST"
printf '%s %s %s\n\n' "$RED" "$BAR" "$RST"
exit 0
