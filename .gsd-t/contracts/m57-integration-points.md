# M57 Integration Points

Milestone: M57 — CI-Parity Verify Gate
Domains: m57-d1-build-coverage-check, m57-d2-ci-command-parity
Wave plan: **1 parallel wave (D1 ∥ D2)** → integrate → verify → complete-milestone

> **RE-PLANNED 2026-05-19** — first design FAILED Red Team (5 non-converging
> cycles, 5 CRITICAL). Domain boundaries / file ownership / wave plan UNCHANGED
> (the defect was the *internal approach* of D1/D2, not the partition). D1 now
> parses CI files structurally (not substring); D2 adds **M57-D2-T2b**
> (containment-safe `clearBuildCaches`, a dedicated Destructive-Action-Guard
> task). D1 = 5 tasks, D2 = 6 tasks. Falsification corpus
> (`test/fixtures/m57-build-coverage/bug*/`, committed 56ddded) is a frozen
> regression input — D1-T4 binds one assertion per fixture.

## Dependency Graph

### Wave 1 — Independent (parallel): D1 ∥ D2
- m57-d1-build-coverage-check: M57-D1-T1 … T5 (intra-domain serial T1→T2→T3→T4→T5)
- m57-d2-ci-command-parity: M57-D2-T1 … T5 (intra-domain serial T1→T2→T3→T4→T5)
- **Shared files**: NONE within the wave — D1 and D2 own strictly disjoint files
- **Cross-domain deps**: NONE — neither domain reads the other's output at execute time
- **Completes when**: both domains' T5 (contract STABLE) done + tests green

### Integration (serial, after Wave 1)
- CHECKPOINT C1: D1 execute clean → D1 wire-in unblocked
- CHECKPOINT C2: D2 execute clean → D2 wire-in unblocked
- INTEGRATION: serially edit the two SHARED files (`bin/gsd-t.js` dispatch +
  global-bin arrays; `commands/gsd-t-verify.md` FAIL-blocking gate) — D1 wire-in
  then D2 wire-in, single agent, no parallelism (same files)
- CHECKPOINT C3: both wire-ins landed → verify unblocked

### Solo-mode execution order
1. Wave 1: D1 T1-T5 and D2 T1-T5 (parallel-safe — run concurrently or interleaved)
2. CHECKPOINT C1 + C2: both domains green
3. Integration: gsd-t.js dispatch + verify.md gate (serial, single agent)
4. CHECKPOINT C3
5. Verify → complete-milestone

## File-Disjointness (parallel wave safety)

D1 and D2 own strictly disjoint files during the execute wave:

| Path | D1 | D2 |
|------|----|----|
| `bin/gsd-t-build-coverage.cjs` | ✅ owns | — |
| `bin/gsd-t-ci-parity.cjs` | — | ✅ owns |
| `.gsd-t/contracts/cli-build-coverage-contract.md` | ✅ owns | — |
| `.gsd-t/contracts/ci-parity-contract.md` | — | ✅ owns |
| `test/m57-d1-build-coverage.test.js` | ✅ owns | — |
| `test/m57-d2-ci-parity.test.js` | — | ✅ owns |
| `test/fixtures/m57-build-coverage/**` | ✅ owns | — |
| `test/fixtures/m57-ci-parity/**` | — | ✅ owns |

No execute-time cross-domain reads. Both INSPECT `bin/gsd-t-verify-gate.cjs` /
`bin/gsd-t.js` as read-only pattern reference — no writes during the wave.

`gsd-t parallel --dry-run` MUST report D1∥D2 as file-disjoint at end of plan.

## Shared Files — Integrate-Sequenced (NOT written in the parallel wave)

These are touched by BOTH domains' wire-ins, so they are written **serially at
the integrate phase**, after both D1 and D2 execute cleanly:

### `bin/gsd-t.js`
- Add `case "build-coverage":` and `case "ci-parity":` dispatch cases — thin
  `spawnSync` dispatchers mirroring the `verify-gate` case (lines ~4544-4561).
- Add `gsd-t-build-coverage.cjs` and `gsd-t-ci-parity.cjs` to the two
  global-bin propagation arrays (~lines 1181-1185 and ~2480-2485).

### `commands/gsd-t-verify.md`
- Add **both** D1 and D2 as FAIL-blocking checks. Failure of either = verify
  **FAIL** → blocks complete-milestone. Never warning-only.
- Wire near the M55 verify-gate block (Step 2) so CI-parity runs as part of the
  mandatory gate, not as an optional dimension.

## Doc-Ripple (integrate phase, after wire-in)

- `templates/CLAUDE-global.md` — Pre-Commit Gate: note CI-parity is enforced by
  `gsd-t-verify` (NOT a new self-attested checklist line — it's mechanically
  gated). Mirror into live `~/.claude/CLAUDE.md` if the template/live invariant
  requires it.
- `GSD-T-README.md` + `README.md` — commands table: add `build-coverage`,
  `ci-parity`.
- `commands/gsd-t-help.md` — add both commands.
- `package.json` — version bump handled at complete-milestone (minor:
  3.26.11 → 3.27.10, new feature).

## Checkpoints

- **C1** — D1 execute clean (module + contract + tests green) → unblocks D1's
  integrate wire-in.
- **C2** — D2 execute clean (module + contract + tests green) → unblocks D2's
  integrate wire-in.
- **C3** — Both wire-ins landed in `gsd-t.js` + `gsd-t-verify.md` (serial) →
  unblocks verify.
- **C4** — Verify PASS (SC1-SC6, deliberately-broken fixtures prove FAIL path,
  Red Team GRUDGING PASS ≥5 broken patches caught) → unblocks complete-milestone.

## Pair-Flag (carry to backlog #25)

When `gsd-t-bench` (backlog #25) ships, its canonical eval set MUST include a
synthetic regression of the TimeTracking v1.10.12 incident (new-dir-not-COPY'd
+ warm-cache-masked tsc strict regression) to guard against M57 regressing.
Tracked here; no M57 code change required.
