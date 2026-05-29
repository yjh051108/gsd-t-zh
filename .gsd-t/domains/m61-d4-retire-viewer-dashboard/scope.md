# Domain: m61-d4-retire-viewer-dashboard

## Responsibility
Delete the custom SSE viewer / dashboard / live-activity stack now covered by native `/workflows` + Agent View. Wave 3 (parallel with D1∥D2∥D3).

## Owned Files (delete)
- `bin/live-activity-report.cjs`
- `bin/gsd-t-transcript-tee.cjs`
- `bin/gsd-t-stream-feed-client.cjs`
- `bin/parallelism-report.cjs`
- `bin/log-tail.cjs`
- `bin/watch-progress.js`
- `bin/event-stream.cjs`
- `scripts/gsd-t-dashboard-server.js`
- `scripts/gsd-t-design-review-server.js` (if dashboard-coupled; if standalone for design review, KEEP — confirm at plan)
- `scripts/hooks/gsd-t-conversation-capture.js`
- `scripts/hooks/gsd-t-stream-feed.js` (if exists)
- `templates/gsd-t-transcript.html` and any sibling viewer HTML
- `commands/gsd-t-visualize.md`
- `.gsd-t/contracts/dashboard-server-contract.md`
- `.gsd-t/contracts/conversation-capture-contract.md`
- `.gsd-t/contracts/event-schema-contract.md` (if dashboard-only)
- `.gsd-t/contracts/live-activity-contract.md`
- `.gsd-t/contracts/parallelism-report-contract.md`
- `.gsd-t/contracts/compaction-events-contract.md`
- `.gsd-t/transcripts/` and `.gsd-t/events/` runtime dirs (gitignored — user decides whether to archive)

## Owned Files (edit)
- `bin/gsd-t.js` — remove `visualize` / `dashboard` / `watch` subcommands
- `~/.claude/settings.json` — remove conversation-capture hook + any stream-feed hook entries

## NOT Owned (do not modify)
- Native `/workflows` view (replaces our viewer)
- Native Agent View (replaces our dashboard)
- `gsd-t-context-brief.cjs` (D7 KEEP)
- `gsd-t-verify-gate.cjs` and stream-json wrapping (D7 KEEP)

## Estimated LOC removed
~2,000 LOC + 1 dashboard script + 1-2 hooks + viewer HTML + 5-7 contracts

## Pre-deletion gate
- `grep -rn "require.*live-activity-report\|require.*transcript-tee\|require.*stream-feed-client\|require.*parallelism-report\|require.*log-tail\|require.*event-stream" --include='*.js' --include='*.cjs' --include='*.md' .` returns only D4-owned files
- Confirm no Workflow script written in D6 depends on the dashboard event stream (it shouldn't — Workflows have their own observability)
