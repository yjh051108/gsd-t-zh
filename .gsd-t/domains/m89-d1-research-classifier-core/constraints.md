# Constraints: m89-d1-research-classifier-core

## Hard Rules
- **Deterministic.** Identical gap text → identical envelope. NO LLM call inside the classifier (it is a
  calculator, mirroring `gsd-t-competition-judge.cjs`). Pure keyword/pattern routing.
- **House-style JSON envelope** per `auto-research-contract.md` §1: `{ok, gap, class, route, reason}` on
  success; `{ok:false, error}` on bad input. The `gap` field is ALWAYS echoed (auditable, never silent).
- **Ambiguous → internal-first.** Default `class:internal, route:grep`; escalation to external is the wiring
  domains' job, not this module's.
- **Zero new runtime deps** (CLI zero-dep invariant). `.cjs`, sync APIs, ANSI colors via escape codes if any.
- **NEVER `route:web` for an internal class** — that pairing is structurally impossible in the envelope.

## Prove-or-Kill Gate
The A1 corpus test is the milestone's load-bearing claim. If any of the 13 labels cannot be hit
deterministically, do NOT soften the corpus or the classifier to force a pass — HALT and escalate for
re-scope. A green A1 unblocks D3/D4 (Wave 2).

## Generalization Standard (finding #1 — anti-self-fulfilling-oracle, the CRITICAL guard)
- The classifier MUST classify by **FEATURE CLASS**, NOT by keywords scraped from the 13 authoring gaps.
  Hard-matching the literal tokens `PayPal`/`OAuth`/`invoice` from the gap strings would pass the seen
  corpus 13/13 yet generalize to nothing — the shallow-test trap. Decide by external-signal vs.
  internal-signal classes (see contract §1's heuristic).
- A1 ALSO feeds the HELD-OUT corpus (`test/fixtures/m89-heldout-corpus.json`, ≥6 NOVEL gaps not used to
  author the classifier) and asserts each label matches by feature class. **"Passes the seen 13 but fails
  any held-out item" is an EXPLICIT FAILURE.** Held-out proper nouns/symbols (Stripe, Chrome storage-quota,
  CSS `:has()`, `isOrderLocked`, `gsd-t-verify.workflow.js`, `cli-preflight`) are absent from the seen
  corpus, so a keyword-memorized router cannot pass.

## Test Standard
- A1 asserts EACH of the 13 SEEN corpus items maps to its hand-label (not just the aggregate count).
- The 7 M87 items → all internal (0 external). The 6 binvoice items → exactly 2-3 external, MUST include the
  PayPal OAuth mint and the invoice-TOTAL-limit findings.
- A1 asserts EACH of the ≥6 HELD-OUT items maps to its hand-label by feature class (generalization gate).
- **Bad-input boundary (finding #6 — SC1):** `classify('')`/`classify('   ')` → `{ok:false,error}` + non-zero
  CLI exit; `classify(non-string)` → `{ok:false,error}`, no throw. These MUST NOT silently return
  `class:internal` — a blank/garbage gap is invalid input, not a default-internal gap.
- A mislabel FAILS (no shallow "length > 0" assertions).
