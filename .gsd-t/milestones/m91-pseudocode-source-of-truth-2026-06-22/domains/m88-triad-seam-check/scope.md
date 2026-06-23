# Scope: m88-triad-seam-check (M91 Wave 3 — M88 G3)

## Mission
Reframe A5 ("the `[RULE]` set is consumed by verify's QA + Red Team frames") from a non-deterministic live-triad observation into a DETERMINISTIC seam-check. Two halves: (1) assert the `qa-subagent.md` / `red-team-subagent.md` prompts carry the structured directive to ingest the guard-map rule set; (2) a unit test that feeds guard-map JSON through the consuming code path and asserts each RULE-ID surfaces in both the QA contract-compliance frame and the Red Team attack-surface frame. A missing directive or a dropped rule FAILS.

## Depends on (Wave 1, already shipped before this runs)
- D1 `guard-bridge-spike` — the guard-map JSON shape (`{rules:{<id>:...}}`) this seam consumes.

## Files Owned
- `templates/prompts/qa-subagent.md` (add the rule-set-ingest directive)
- `templates/prompts/red-team-subagent.md` (add the rule-set-ingest directive)
- `bin/gsd-t-rule-consume.cjs` (new — the consuming code path: guard-map JSON → surfaced RULE-ID set per frame)
- `test/m88-triad-consumption-seam.test.js` (new)

## Out of scope
- A live triad run (explicitly rejected — non-deterministic). This is a seam-check only.
- The verify-workflow triad ORCHESTRATION (not edited; the prompts + the consumer are the seam).

## The deterministic-gate bar (entry criterion)
Deterministic code, ZERO LLM judgment; structural-not-substring; killing test; no silent degradation.
