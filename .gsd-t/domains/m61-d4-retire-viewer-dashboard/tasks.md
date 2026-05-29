# Tasks: m61-d4-retire-viewer-dashboard

## Summary
Delete viewer / dashboard SSE stack + conversation-capture hook. Wave 3, parallel with D1/D2/D3.

## Tasks

### Task M61-D4-T1 — Decide fate of `scripts/gsd-t-design-review-server.js`
- **Touches**: reads `scripts/gsd-t-design-review-server.js`; writes `.gsd-t/scan/m61-d4-design-review-server-decision.md`
- **Contract refs**: NONE
- **Dependencies**: NONE
- **Acceptance**: Read the file. If it only consumes `.gsd-t/contracts/design/` and serves a design-review UI independent of the dashboard, mark KEEP and move to D7 scope. If it depends on `bin/event-stream.cjs` / `bin/live-activity-report.cjs` / shares plumbing with dashboard, mark DELETE.

### Task M61-D4-T2 — Zero-reference gate
- **Touches**: writes `.gsd-t/scan/m61-d4-zero-ref-verify.txt`
- **Contract refs**: NONE
- **Dependencies**: BLOCKED by T1, D6-T7, D7-T2
- **Acceptance**: `grep -rn "require.*live-activity-report\|require.*gsd-t-transcript-tee\|require.*stream-feed-client\|require.*parallelism-report\|require.*log-tail\|require.*event-stream" --include='*.js' --include='*.cjs' --include='*.md' .` returns only D4-owned files.

### Task M61-D4-T3 — Delete dashboard / viewer / SSE / conversation-capture
- **Touches** (delete): `bin/live-activity-report.cjs`, `bin/gsd-t-transcript-tee.cjs`, `bin/gsd-t-stream-feed-client.cjs`, `bin/parallelism-report.cjs`, `bin/log-tail.cjs`, `bin/watch-progress.js`, `bin/event-stream.cjs`, `scripts/gsd-t-dashboard-server.js`, `scripts/hooks/gsd-t-conversation-capture.js`, `templates/gsd-t-transcript.html` + sibling viewer HTML, `commands/gsd-t-visualize.md`, `.gsd-t/contracts/dashboard-server-contract.md`, `conversation-capture-contract.md`, `event-schema-contract.md` (if dashboard-only), `live-activity-contract.md`, `parallelism-report-contract.md`, `compaction-events-contract.md`; conditionally `scripts/gsd-t-design-review-server.js` per T1
- **Touches** (edit): `bin/gsd-t.js` (remove `visualize` / `dashboard` / `watch` subcommands); `~/.claude/settings.json` (remove conversation-capture hook entry only); archive sample `.gsd-t/transcripts/*.ndjson` under `.gsd-t/milestones/m61-*/sample-transcripts/`
- **Contract refs**: all about-to-be-deleted contracts
- **Dependencies**: BLOCKED by T2
- **Acceptance**: Suite green. settings.json valid JSON, only conversation-capture hook removed (date-guard, version-check, compact-detector, capture all preserved). `gsd-t-visualize` no longer in help.

## Execution Estimate
- Total tasks: 3
- Independent: 1 (T1)
- Blocked: 2

## Files Owned
- All deletion targets exclusively
- `~/.claude/settings.json` conversation-capture hook entry (shared with D1/D3; sequenced)
- `bin/gsd-t.js` visualize/dashboard/watch subcommands (shared; sequenced)
- `.gsd-t/transcripts/` archive sampling
