#!/usr/bin/env bash
# GSD-T Post-Commit Spawn-Plan Hook — installed by `gsd-t init`
#
# This is a thin shim that delegates to the canonical hook script
# shipped with GSD-T. If your project doesn't yet have the canonical
# script, this template copy handles commits by itself; once the
# framework script is in place, the framework wins.
#
# Contract: .gsd-t/contracts/spawn-plan-contract.md v1.0.0

set +e  # silent-fail — never break the commit

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$PROJECT_DIR" ] || [ ! -d "$PROJECT_DIR/.gsd-t/spawns" ]; then
  exit 0
fi

CANONICAL="$PROJECT_DIR/scripts/gsd-t-post-commit-spawn-plan.sh"
if [ -x "$CANONICAL" ]; then
  # Delegate to the framework-shipped hook.
  "$CANONICAL"
  exit 0
fi

UPDATER="$PROJECT_DIR/bin/spawn-plan-status-updater.cjs"
if [ ! -f "$UPDATER" ]; then
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[spawn-plan-hook] node not found — skipping" 1>&2
  exit 0
fi

COMMIT_SHA="$(git rev-parse --short HEAD 2>/dev/null)"
COMMIT_MSG="$(git log -1 --format=%B 2>/dev/null)"
if [ -z "$COMMIT_SHA" ] || [ -z "$COMMIT_MSG" ]; then
  exit 0
fi

TASK_IDS="$(printf '%s' "$COMMIT_MSG" | grep -oE '\[M[0-9]+-D[0-9]+-T[0-9]+\]' | sed 's/[][]//g' | awk '!seen[$0]++')"
if [ -z "$TASK_IDS" ]; then
  exit 0
fi

printf '%s\n' "$TASK_IDS" | node -e '
"use strict";
try {
  const path = require("path");
  const fs = require("fs");
  const projectDir = process.argv[1];
  const commit = process.argv[2];
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => { raw += c; });
  process.stdin.on("end", () => {
    try {
      const taskIds = raw.split("\n").map((s) => s.trim()).filter(Boolean);
      if (!taskIds.length) process.exit(0);
      const updater = require(path.join(projectDir, "bin", "spawn-plan-status-updater.cjs"));
      const activePaths = updater.listActivePlans(projectDir);
      if (!activePaths.length) process.exit(0);
      for (const fp of activePaths) {
        let plan;
        try { plan = JSON.parse(fs.readFileSync(fp, "utf8")); } catch (_) { continue; }
        const spawnId = plan && plan.spawnId;
        const spawnStartedAt = plan && plan.startedAt;
        if (!spawnId) continue;
        const planTaskIds = new Set((plan.tasks || []).map((t) => t && t.id).filter(Boolean));
        for (const taskId of taskIds) {
          if (!planTaskIds.has(taskId)) continue;
          const tokens = updater.sumTokensForTask({ projectDir, taskId, spawnStartedAt });
          updater.markTaskDone({ spawnId, taskId, commit, tokens, projectDir });
        }
      }
    } catch (err) {
      try { process.stderr.write("[spawn-plan-hook] " + String(err && err.message || err) + "\n"); } catch (_) { /* silent */ }
    }
  });
} catch (err) {
  try { process.stderr.write("[spawn-plan-hook] " + String(err && err.message || err) + "\n"); } catch (_) { /* silent */ }
}
' "$PROJECT_DIR" "$COMMIT_SHA" 2>/dev/null

exit 0
