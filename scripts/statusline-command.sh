#!/usr/bin/env bash
# Claude Code status line — GSD-T project status bar  (CANONICAL SOURCE)
#
# This is the SHIPPED source of truth for the GSD-T status line. The installer
# copies it to ~/.claude/statusline-command.sh and wires the `statusLine` setting
# to it, so edits here survive `gsd-t install` / `update` / `update-all`.
# (Supersedes scripts/gsd-t-statusline.js, whose context source was retired in M61.)
#
# Layout (M85):
#   Line 1: [GSD-T] | vX.Y.ZZ | ctx N% left | project | git branch | model id | HH:MM TZ
#   Line 2: the full milestone/Status string (wraps to its own row instead of
#           being truncated with a trailing "…" at terminal width).
set -o pipefail

input=$(cat)

# --- 1. [GSD-T] prefix (bright cyan when ANSI available) ---
PREFIX=$'\033[1;36m[GSD-T]\033[0m'

# --- 1b. GSD-T version — the installed framework version, project-independent.
#       Source from ~/.claude/.gsd-t-version (written by the installer/update-all);
#       fall back to the global package.json, then to empty (field omitted). ---
gsdt_version=""
if [ -f "$HOME/.claude/.gsd-t-version" ]; then
  gsdt_version=$(tr -d '[:space:]' < "$HOME/.claude/.gsd-t-version" 2>/dev/null)
fi
if [ -z "$gsdt_version" ] && command -v gsd-t >/dev/null 2>&1; then
  gsdt_version=$(gsd-t --version 2>/dev/null | tr -d '[:space:]')
fi
[ -n "$gsdt_version" ] && gsdt_version="v${gsdt_version#v}"

# --- 2. Project name — basename of cwd from JSON ---
cwd=$(printf '%s' "$input" | jq -r '.workspace.current_dir // .cwd // ""')
project=""
if [ -n "$cwd" ]; then
  project=$(basename "$cwd")
fi

# --- 3. Milestone + phase — single grep of .gsd-t/progress.md ---
milestone=""
if [ -n "$cwd" ] && [ -f "${cwd}/.gsd-t/progress.md" ]; then
  milestone=$(grep -m1 '^## Status:' "${cwd}/.gsd-t/progress.md" | sed 's/^## Status:[[:space:]]*//' | tr -d '\r')
fi

# --- 4. Git branch (skip gracefully if not a repo) ---
branch=""
if [ -n "$cwd" ]; then
  branch=$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
fi

# --- 5. Model id ---
model=$(printf '%s' "$input" | jq -r '.model.id // ""')

# --- 6. Context window % left (M61: read latest usage envelope from Claude
#       Code's session JSONL; falls back silently if unreadable).
#       Window: 1,000,000 for Opus 4.7/4.8 + Sonnet 4.x; 200,000 for Haiku.
#       Computed as input_tokens + cache_creation_input_tokens +
#       cache_read_input_tokens to capture the full window pressure. ---
ctx_left=""
if [ -n "$cwd" ]; then
  proj_slug=$(printf '%s' "$cwd" | sed 's:/:-:g')
  sess_dir="$HOME/.claude/projects/$proj_slug"
  if [ -d "$sess_dir" ]; then
    latest_jsonl=$(ls -t "$sess_dir"/*.jsonl 2>/dev/null | head -1)
    if [ -n "$latest_jsonl" ]; then
      # Window size by model family. Haiku = 200k; everything else = 1M.
      case "$model" in
        *haiku*) win=200000 ;;
        *)       win=1000000 ;;
      esac
      # Grab the last "usage" record in the file and sum input fields.
      used=$(grep '"usage"' "$latest_jsonl" 2>/dev/null \
             | tail -1 \
             | jq -r '
               (.message.usage // {})
               | (.input_tokens // 0)
                 + (.cache_creation_input_tokens // 0)
                 + (.cache_read_input_tokens // 0)
             ' 2>/dev/null)
      if [ -n "$used" ] && [ "$used" -gt 0 ] 2>/dev/null; then
        ctx_left=$(awk -v u="$used" -v w="$win" \
          'BEGIN { p = 100 - (u / w * 100); printf "ctx %d%% left", (p + 0.5) }')
      fi
    fi
  fi
fi

# --- 7. Local time ---
timestamp=$(date +"%H:%M %Z")

# --- Assemble ---
# Line 1: short fields only. ctx% sits right after the version (per user).
#         The verbose milestone status moves to line 2 so it wraps instead of
#         being truncated with a trailing "…" at terminal width.
parts=("$PREFIX")
[ -n "$gsdt_version" ] && parts+=("$gsdt_version")
[ -n "$ctx_left" ]  && parts+=("$ctx_left")
[ -n "$project" ]   && parts+=("$project")
[ -n "$branch" ]    && parts+=("$branch")
[ -n "$model" ]     && parts+=("$model")
parts+=("$timestamp")

# Join line 1 with " | "
line1=""
for part in "${parts[@]}"; do
  if [ -z "$line1" ]; then
    line1="$part"
  else
    line1="${line1} | ${part}"
  fi
done

# Line 2: the milestone/status string on its own line (Claude Code renders \n as a
# second status row). Omitted when there's no milestone status.
if [ -n "$milestone" ]; then
  printf '%s\n%s' "$line1" "$milestone"
else
  printf '%s' "$line1"
fi
