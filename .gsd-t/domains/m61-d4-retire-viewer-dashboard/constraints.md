# Constraints: m61-d4-retire-viewer-dashboard

## Must Follow
- Destructive Action Guard: the viewer is user-visible. Confirm at plan-review that the user has migrated to `/workflows` and Agent View and no longer relies on the custom dashboard.
- Settings.json hook removal happens in a separate commit from bin/ deletion for revert clarity.
- Archive (don't delete) representative `.gsd-t/transcripts/*.ndjson` samples under `.gsd-t/milestones/m61-*/sample-transcripts/` for future debugging reference.

## Must Not
- Delete `scripts/gsd-t-design-review-server.js` until plan confirms it is dashboard-coupled (it may be standalone — design-review-only — and belong on the KEEP list)
- Touch `.gsd-t/contracts/design-contract.md` or `design/` hierarchy (D7 KEEP — methodology, not infra)
- Remove event/transcript hooks that the user wants for personal logging (ask at plan)

## Must Read Before Deleting
- `scripts/gsd-t-design-review-server.js` — read it to confirm coupling; if it only consumes design contracts and runs its own server, KEEP and move to D7
- `~/.claude/settings.json` — only remove the conversation-capture + stream-feed hook entries; preserve all others

## Dependencies
- Depends on: D6 (Workflows have native observability; no dependency on our SSE stream)
- Depended on by: D8 (CLAUDE.md "In-Session Conversation Capture" section removed after this lands)
- Parallel-with: D1, D2, D3 (file-disjoint in Wave 3)
