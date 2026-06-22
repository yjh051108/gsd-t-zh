# Domain Tasks: m90-d-factual-redesign (M90-D3)

> Shape D — `### Mxx-Dx-Tx`, each task carries `**Files**`, `**Touches**`, `**Test**`,
> `**Acceptance criteria**`, `**Dependencies**`, `**Contract**`. Validate at end of plan with
> `gsd-t parallel --dry-run` + `gsd-t traceability-gate --milestone M90`.
> **Domain code = D3** (parser-canonical `M90-D3-Tn`; partition's `DF` letter form renamed to
> satisfy the task-graph regex). Edit-in-place island — the EXISTING M89 module is on disk
> (`bin/gsd-t-research-gate.cjs:146` `EXTERNAL_VENDOR_NOUNS`, `:166` `EXTERNAL_API_TERMS`,
> `:209` `hasStrongExternal`, `:188` `classify`, `:304` `module.exports = { classify }`).

## Files Owned
- `bin/gsd-t-research-gate.cjs`
- `test/m89-research-classifier-corpus.test.js`
- `test/fixtures/m89-labeled-corpus.json`

## Contract
`.gsd-t/contracts/m90-doctrine-mechanisms-contract.md` §1 — the `classify(gap)` envelope is
the FROZEN seam D4 wires; the §7 fail-closed cite gate is PRESERVED. Absorbs
`auto-research-contract.md` v1.3.3 (D4 writes the absorbed pointer). Redesign sourced from:
SKR intrinsic self-knowledge gate (https://arxiv.org/abs/2310.05002), Self-RAG
(https://arxiv.org/abs/2310.11511), temporal-collapse → always-verify on fast-moving facts
(https://arxiv.org/html/2510.19172v1, CoVe https://arxiv.org/abs/2309.11495).

## Wave 2 — edit-in-place (GATED on Wave 1 prove-or-kill clearing; LOWEST RISK)

### M90-D3-T1 — DELETE the vendor-list machinery (R-FACT-1) [Headline]
**Headline:** true
Remove `EXTERNAL_VENDOR_NOUNS` (`:146`), `EXTERNAL_API_TERMS` (`:166`), and every
`hasStrongExternal`/`matchedVendor`/`matchedApiTerm` path that consumes them (`:207`–`:227+`).
Grep for ALL requirers first; inline-then-delete so nothing dangles. The regex now asserts
INTERNAL only on a concrete own-repo path/file (a CLOSED, knowable set) — this is the exact
frozen-belief bug M90 exists to kill (an OPEN category was hardcoded as a finite list).
- **Files**: `bin/gsd-t-research-gate.cjs`
- **Touches**: `bin/gsd-t-research-gate.cjs`
- **Test**: `test/m89-research-classifier-corpus.test.js` — a grep/AST assertion that `EXTERNAL_VENDOR_NOUNS` / `EXTERNAL_API_TERMS` / `hasStrongExternal` no longer appear in the source; the vendor-deletion negative test (an out-of-list vendor like GitHub/Slack/OpenAI no longer string-matches → routes to judge, never silent-internal).
- **Acceptance criteria**: (SC-NO-FINITE-LIST)
  - `EXTERNAL_VENDOR_NOUNS`, `EXTERNAL_API_TERMS`, and all consuming match paths are removed (no dangling refs — full grep done first).
  - The recognition layer enumerates NO open category — `internal` is asserted ONLY on a concrete own-repo path/file.
  - An out-of-list/never-seen vendor (GitHub/Slack/OpenAI/a freshly-invented name) is NOT string-matched to external/internal — it routes to judge/research.
- **Dependencies**: M90-D1-T6, M90-D2-T6 (Wave 1 GREEN gate). First task of this domain.

### M90-D3-T2 — Closed-internal + judge routing (R-FACT-2)
Internal ONLY on the closed own-repo path/file set; everything not-confidently-internal →
`ambiguous` → judge → external/uncertain → research+cite. The mechanical layer recognizes only
the closed internal set; the open external world is the judge's call (the locked architecture:
mechanical-knows-closed-sets, LLM-judges-open-world). Keep the house-style envelope + bad-input
guard.
- **Files**: `bin/gsd-t-research-gate.cjs`
- **Touches**: `bin/gsd-t-research-gate.cjs`
- **Test**: `test/m89-research-classifier-corpus.test.js` — a concrete own-repo path → `class:"internal", route:"grep"`; a non-path external assertion → `class:"external"|"ambiguous", route:"web"|"judge"`; bad input → `{ok:false}`.
- **Acceptance criteria**:
  - A concrete own-repo path/file → `{ ok:true, class:"internal", route:"grep" }`.
  - Not-confidently-internal → `ambiguous` → judge → external/uncertain → research+cite (`route:"web"|"judge"`).
  - House-style envelope + bad-input guard preserved (`{ ok:false }` + non-zero exit on bad input).
- **Dependencies**: M90-D3-T1.

### M90-D3-T3 — Time-anchored protocol override (R-FACT-3)
Add the always-verify override: a fast-moving lib/API/version OR "current/latest best practice"
→ research regardless of confidence (CoVe-style; intrinsic self-knowledge signals collapse to
chance on the temporal axis, so a confidence gate can't catch a stale-but-confident fact).
Deterministic.
- **Files**: `bin/gsd-t-research-gate.cjs`
- **Touches**: `bin/gsd-t-research-gate.cjs`
- **Test**: `test/m89-research-classifier-corpus.test.js` — a "current/latest best practice" gap + a version/library-freshness gap → route to research REGARDLESS of any internal/confidence signal; deterministic across runs.
- **Acceptance criteria**: (covers GUESSED:stale)
  - A fast-moving lib/API/version gap → research (`route:"web"`) regardless of confidence.
  - A "current/latest best practice" gap → research regardless of confidence.
  - The override is deterministic and does not depend on a self-reported confidence field.
- **Dependencies**: M90-D3-T2.

### M90-D3-T4 — KEEP §7 fail-closed cite gate (R-FACT-4)
Verify the §7 fail-closed cite gate is PRESERVED unchanged: an external claim left uncited →
verify FAILS (the classify-time `status=uncited` marker, cite-time flip). This is a
no-regression check on the existing M89 behavior — D4 owns the verify-side read; this domain
must not break the marker the classifier writes.
- **Files**: `bin/gsd-t-research-gate.cjs`
- **Touches**: `bin/gsd-t-research-gate.cjs`
- **Test**: `test/m89-research-classifier-corpus.test.js` — an external claim emits the `status=uncited` marker; the marker contract (write-at-classify, flip-at-cite) is unchanged vs. the ed03a8d baseline.
- **Acceptance criteria**: (SC-FAIL-CLOSED)
  - An external claim emits the uncited-external marker (`status=uncited`) at classify time.
  - The marker shape is unchanged vs. the M89 baseline (D4's verify gate reads it unmodified).
  - When research is required but inconclusive, the path fails CLOSED (no silent proceed).
- **Dependencies**: M90-D3-T3.

### M90-D3-T5 — Corpus + classifier test redesign [Headline]
**Headline:** true
Update `test/m89-research-classifier-corpus.test.js` + `test/fixtures/m89-labeled-corpus.json`:
assert NO external-enumeration path remains (the vendor-deletion negative test — ≥10
out-of-any-prior-list external references, including a freshly-invented vendor name, each route
to judge/research, NONE silently internal); assert the closed INTERNAL set + time-anchored
override classify the labeled corpus DETERMINISTICALLY; re-label vendor-dependent rows to the
safe (judge) direction; keep the held-out generalization guard. Test count ≥ the ed03a8d
baseline (1824/0) — SC-FACTUAL-PRESERVED.
- **Files**: `test/m89-research-classifier-corpus.test.js`, `test/fixtures/m89-labeled-corpus.json`, `bin/gsd-t-research-gate.cjs`
- **Touches**: `test/m89-research-classifier-corpus.test.js`, `test/fixtures/m89-labeled-corpus.json`
- **Test**: `test/m89-research-classifier-corpus.test.js` (node --test) — the redesigned corpus test IS this file; ≥10 never-seen external refs → judge/research (none internal), closed-internal set + time-anchored override classify deterministically, held-out generalization guard retained. Run: `node --test test/m89-research-classifier-corpus.test.js`.
- **Acceptance criteria**: (SC-NO-FINITE-LIST + SC-FACTUAL-PRESERVED)
  - A known-answer test feeds ≥10 out-of-any-prior-list external references (incl. a freshly-invented vendor name); each routes to judge-or-research, NONE silently classified internal.
  - The closed INTERNAL set + time-anchored override classify the labeled corpus deterministically.
  - Held-out generalization guard retained (no keyword-memorization).
  - Suite green at test count ≥ the ed03a8d baseline (1824/0) — no factual-slice regression.
- **Dependencies**: M90-D3-T4.

## Dependency / gating
- **Gated on Wave 1** clearing prove-or-kill (risk-first build order). If Wave 1 R1-exits to factual-only, THIS domain CARRIES the milestone.
- T1→T5 build the same module + its test — write in order.
- File-disjoint from all other domains; its only shared dependency is the §1 envelope shape (pinned by the mechanisms contract) which D3 CONSUMES but does not write.
