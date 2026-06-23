# Scope: m88-map-derivation-seam (M91 Wave 3 — M88 G2)

## Mission
The mechanical build→rule-map DERIVATION seam + its end-to-end test. M87's A1 (D1) proves the guard-map gate DISCRIMINATES a faithful vs doctored `--map` JSON, but the doctored fixture differs only in the LLM-PRODUCED map (the doc stays byte-identical) — so the PATH that derives the map from the build (which test assertions back which `[RULE]`) is untested. This domain designs the deterministic derivation `build evidence → {rules:{<id>:{backedBy:[...],contradicted:bool}}}` and an end-to-end test that runs derivation → D1's gate on a real build.

## Depends on (Wave 1, already shipped before this runs)
- D1 `guard-bridge-spike` — `bin/gsd-t-guard-map.cjs` (the gate the derived map feeds) + the `[RULE]` parser + the §2 RULE-ID derivation. This domain produces input FOR that gate; it does NOT edit it.

## Files Owned
- `bin/gsd-t-guard-map-derive.cjs` (new)
- `test/m88-map-derivation-e2e.test.js` (new)

## Out of scope
- The guard-map GATE itself (`bin/gsd-t-guard-map.cjs`, D1-owned, already shipped) — this domain only DERIVES the map the gate consumes.
- The verify-workflow wiring (D1-owned).

## The deterministic-gate bar (entry criterion)
Deterministic code, ZERO LLM judgment; structural-not-substring; killing test against byte-verbatim fixtures; no silent degradation.
