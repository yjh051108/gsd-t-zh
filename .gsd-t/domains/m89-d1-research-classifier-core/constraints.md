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

## Test Standard
- A1 asserts EACH of the 13 corpus items maps to its hand-label (not just the aggregate count).
- The 7 M87 items → all internal (0 external). The 6 binvoice items → exactly 2-3 external, MUST include the
  PayPal OAuth mint and the invoice-TOTAL-limit findings.
- A mislabel FAILS (no shallow "length > 0" assertions).
