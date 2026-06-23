# Tasks: m88-map-derivation-seam (M91 Wave 3 — M88 G2)

## Files Owned
- `bin/gsd-t-guard-map-derive.cjs`
- `test/m88-map-derivation-e2e.test.js`

---

### M88-G2-T1 — Build→rule-map derivation seam
**Touches**: `bin/gsd-t-guard-map-derive.cjs`
**PseudoCode-Section**: PseudoCode-PayPal#6-money-safety-map-every-guard-against-a-double-create
Implement the mechanical seam that DERIVES the build→rule map D1's gate reads,
instead of hand-authoring it. Input: a PseudoCode doc (for the derived RULE-ID set
via D1's parser grammar — IMPORT the parser from `bin/gsd-t-guard-map.cjs`, do NOT
re-implement it) + a build-evidence manifest (a structured list of test
assertions/files, each tagged with the RULE-ID(s) it backs — e.g. a
`// backs: R-PAYPAL-03` annotation harvested from test files, or an explicit
evidence JSON). Output: `{rules:{<id>:{backedBy:[<evidence refs>], contradicted:bool}}}`
keyed EXACTLY to the doc's derived RULE-ID set (every doc rule present; a rule with
no evidence → `backedBy:[]` = unbacked, NOT omitted — so the gate's doc-keyed
non-vacuity holds). Zero deps, never throws, pure. CLI:
`--doc <path> --evidence <path> --json`.
**Acceptance criteria**: derived map keyset EXACTLY equals D1's parser's derived id set for the doc (no extra/missing key); a rule with evidence → non-empty `backedBy`; a rule with none → `backedBy:[]` (present, not omitted); the derived map is valid input to `bin/gsd-t-guard-map.cjs` (consumable by the gate unchanged).
**Files**: `bin/gsd-t-guard-map-derive.cjs`.
**Test**: M88-G2-T2.
**Headline**: true

### M88-G2-T2 — End-to-end derivation→gate test (closes the untested-derivation gap)
**Touches**: `test/m88-map-derivation-e2e.test.js`
**PseudoCode-Section**: PseudoCode-PayPal#6-money-safety-map-every-guard-against-a-double-create
The backlog #35 killing test for the moved A1 piece: derivation INCLUDED, not
hand-authored. In a redirected temp dir, seed a real PseudoCode doc + an evidence
manifest where every derived RULE-ID is backed. Then:
- run DERIVATION → feed the derived map (not a hand-authored fixture) to D1's
  `bin/gsd-t-guard-map.cjs` → **exit 0** (faithful build);
- REMOVE one backing assertion from the evidence manifest → re-derive → feed to the
  gate → **exit non-zero**, the now-unbacked RULE-ID NAMED in output;
- assert the derived map's keyset EXACTLY equals D1's parser's derived id set
  (generated programmatically from the parse, never hand-typed).
Both legs deterministic, end-to-end (derivation + gate), zero LLM.
**Acceptance criteria**: a real derived map → gate exit 0 on a faithful build; removing one backing assertion → re-derived map → gate exit non-zero naming the rule; derived keyset == parser-derived id set (programmatic, not hand-typed).
**Files**: `test/m88-map-derivation-e2e.test.js`.
**Test**: this IS the test (exercises M88-G2-T1's derive + D1's `bin/gsd-t-guard-map.cjs`).
