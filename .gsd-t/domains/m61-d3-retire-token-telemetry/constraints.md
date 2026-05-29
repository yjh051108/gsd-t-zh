# Constraints: m61-d3-retire-token-telemetry

## Must Follow
- Destructive Action Guard: telemetry has accreted across many commands. The 13 command-file OBSERVABILITY block removals happen in Wave 2 (D7), not in this domain. D3 only deletes the bin/ scripts + hook + contracts after the live references are already gone.
- Test files for retired modules deleted with the module.
- Archive (not delete) `.gsd-t/token-log.md` under `.gsd-t/milestones/m61-*/` — it has historical value as the trailing-window cost baseline referenced in past milestones.

## Must Not
- Touch the `.gsd-t/test-data-ledger.jsonl` file or its adapters (D7 KEEP)
- Remove `budget.spent()` calls inside Workflow scripts written in D6 (those are the native replacement)
- Delete `.gsd-t/metrics/` runtime data without confirming the user is fine with that (gitignored, but possibly archived locally)

## Must Read Before Deleting
- The 13 command files listed in scope.md — confirm Wave 2 (D7) commits removed every `captureSpawn` / `recordSpawnRow` invocation before deletion
- `bin/gsd-t.js` CLI dispatcher — confirm subcommand removal doesn't break `gsd-t doctor` or `gsd-t status`

## Dependencies
- Depends on: D6 (Workflow scripts use native `budget`), D7 (Wave 2 de-wires command files)
- Depended on by: D8 (CLAUDE.md "Observability Logging" + "Token Capture Rule" sections removed after this lands)
- Parallel-with: D1, D2, D4 (file-disjoint in Wave 3)
