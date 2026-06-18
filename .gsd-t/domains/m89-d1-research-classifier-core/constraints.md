# Constraints: m89-d1-research-classifier-core

## Hard Rules
- **Input is a GUESSED CLAIM** (premise correction, contract §1), not "a gap" — a claim the agent tagged
  GUESSED in its Stated-Claims list (§6.5). The `gap` envelope field name is retained for shape stability.
- **Deterministic.** Identical claim text → identical envelope. NO LLM call inside the classifier (it is a
  calculator, mirroring `gsd-t-competition-judge.cjs`). Pure feature-class routing.
- **House-style JSON envelope** per `auto-research-contract.md` §1: `{ok, gap, class, route, reason}` on
  success; `{ok:false, error}` on bad input. The `gap` field is ALWAYS echoed (auditable, never silent).
- **Ambiguous → internal-first.** Default `class:internal, route:grep`; escalation to external is the wiring
  domains' job, not this module's.
- **Zero new runtime deps** (CLI zero-dep invariant). `.cjs`, sync APIs, ANSI colors via escape codes if any.
- **NEVER `route:web` for an internal class** — that pairing is structurally impossible in the envelope.

## Prove-or-Kill Gate
The A1 corpus test is the milestone's load-bearing claim. If any of the 13 SEEN + 8 HELD-OUT labels
cannot be hit deterministically (incl. the proper-noun-less external HO-E4 and symbol-only internal
HO-I4), do NOT soften the corpus or the classifier to force a pass — HALT and escalate for re-scope.
A green A1 unblocks D3/D4 (Wave 2).

## Generalization Standard (finding #1 — anti-self-fulfilling-oracle, the CRITICAL guard)
- The classifier MUST classify by **FEATURE CLASS**, NOT by keywords scraped from the 13 authoring gaps.
  Hard-matching the literal tokens `PayPal`/`OAuth`/`invoice` from the gap strings would pass the seen
  corpus 13/13 yet generalize to nothing — the shallow-test trap. Decide by external-signal vs.
  internal-signal classes (see contract §1's heuristic).
- A1 ALSO feeds the HELD-OUT corpus (`test/fixtures/m89-heldout-corpus.json`, 8 NOVEL guessed-claims not
  used to author the classifier) and asserts each label matches by feature class. **"Passes the seen 13
  but fails any held-out item" is an EXPLICIT FAILURE.** Held-out proper nouns/symbols are absent from the
  seen corpus, so a keyword-memorized router cannot pass.
- **Premise-correction guards (contract §1, v1.2.0):** the classifier MUST label **HO-E4** (a
  PROPER-NOUN-LESS external claim — "the payments endpoint accepts a max batch size of 100") `external`,
  because it ASSERTS an external system's behavior unverified — NOT default it internal for lacking a
  vendor name (the cycle-2 finding #3 silent-miss). And **HO-I4** (a SYMBOL-ONLY internal claim about
  `resolveProfile`, no path/anchor) `internal`. These prove the discriminator is
  external-assertion-vs-local-symbol, not surface keywords.

## Test Standard
- A1 asserts EACH of the 13 SEEN corpus items maps to its hand-label (not just the aggregate count).
- The 7 M87 items → all internal (0 external). The 6 binvoice items → exactly 2-3 external, MUST include the
  PayPal OAuth mint and the invoice-TOTAL-limit findings.
- A1 asserts EACH of the ≥6 HELD-OUT items maps to its hand-label by feature class (generalization gate).
- **Bad-input boundary (finding #6 — SC1):** `classify('')`/`classify('   ')` → `{ok:false,error}` + non-zero
  CLI exit; `classify(non-string)` → `{ok:false,error}`, no throw. These MUST NOT silently return
  `class:internal` — a blank/garbage gap is invalid input, not a default-internal gap.
- A mislabel FAILS (no shallow "length > 0" assertions).
