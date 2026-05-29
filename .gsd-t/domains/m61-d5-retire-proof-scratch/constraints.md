# Constraints: m61-d5-retire-proof-scratch

## Must Follow
- Destructive Action Guard: each file's zero-reference status confirmed at plan time before deletion. These are the safest deletions in M61 (no live consumers).
- Single commit for the deletion block; clean revert if anything goes wrong.

## Must Not
- Delete anything that has a live caller
- Delete `.gsd-t/ratelimit-map.json` (it's data, not scratch — archive instead)
- Touch Workflow scripts (D6)

## Must Read Before Deleting
- Run the grep gate listed in scope.md immediately before commit (defense in depth — references can appear between partition and execute)

## Dependencies
- Depends on: nothing (zero live consumers — by definition)
- Depended on by: D8 (verifies no doc references the deleted files)
- Parallel-with: D6 in Wave 1 (entirely file-disjoint from D6 orchestration migration)
