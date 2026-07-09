# GSD-T Framework Reference — v4.12.10

This file is a companion to `README.md` and tracks framework-level documentation — methodology decisions, internal architecture, and per-milestone capability summaries. Maintained alongside `README.md` per the Pre-Commit Gate.

---

## Model Tier Policy (M85)

`bin/gsd-t-model-tier-policy.cjs` is the SINGLE source of truth for model-tier assignments. The M85 Fable assignments (contract v1.1.0 STABLE):

| Stage | Tier | Why |
|-------|------|-----|
| `solution-space-probe` | `fable` | Highest-leverage upstream judgment |
| `partition-probe` | `fable` | Domain decomposition quality gates entire wave |
| `competition-judge` | `fable` | Blind judge in competition mode |
| `competition-producers` | `opus` | HELD — M82 blindness invariant (never fable) |
| `pre-mortem` | `fable` | Attack the design before any code is written |
| `red-team` | `fable` | Adversarial security + correctness after build |
| `debug-cycle-2` | `fable` | Escalation tier for hard bugs |

The M71-family drift lint (`test/m85-workflow-tier-policy-lint.test.js`) mechanically enforces that every workflow `model:` literal matches the policy — a drifted literal FAILS the lint.

---

## Model Profiles (M86)

`bin/gsd-t-model-profile.cjs` adds a per-project **tier-spend switch** as a second dimension over the M85 stage-tier policy. Contract: `.gsd-t/contracts/model-profile-config-contract.md` v1.0.0 STABLE.

### Profile Dimension

| Profile | Fable stages | Definition |
|---------|--------------|------------|
| `standard` | None | Pre-M85 posture: probes→opus, judge→sonnet, pre-mortem→opus, red-team→opus, debug both cycles→opus |
| `pro` | red-team + pre-mortem + debug-cycle-2 | Three highest-value Fable gates; everything else reverts to standard |
| `premium` | All 6 M85 designated stages | Full M85 posture — **global default** |

`competition-producers` is `opus` in ALL profiles (M82 blindness invariant — not overridable).

### Per-Project Config

`.gsd-t/model-profile.json`:
```json
{ "profile": "pro", "stageOverrides": { "competition-judge": "fable" } }
```

- Absent file → global default (`premium`), NAMED in the banner/statusline/status (SC(f) — no silent degradation).
- `stageOverrides` → per-stage tier that beats the profile. Blindness clamps enforced at resolve time.

### Invoke-Time Injection (M69)

Command invokers (`commands/gsd-t-{partition,verify,debug,...}.md`) call the resolver at invoke time, build an `overrides` map, and inject it into the workflow via `args`. Workflows read `overrides` (default `{}`). No tracked-file rewriting on profile switch — the entire point is invoke-time injection.

### Active Profile Surfacing

The active profile is always named — never blank, never an implicit fallback (SC(f)):

- **Session banner** (`scripts/gsd-t-auto-route.js`): `[GSD-T PROFILE] profile: pro` — emitted on every turn, every project.
- **Statusline** (`scripts/gsd-t-statusline.js`): `│ profile: pro` — shown in `statusLine`.
- **`gsd-t status`** (`commands/gsd-t-status.md`): `Model Profile: pro` — in the status report header.

When the config is absent: `profile: premium (default)`. When config is malformed: `profile: premium (default, config-error: <reason>)`.

### Workflow `??`-Form

Each designated workflow stage uses the `??`-form:
```js
model: overrides["<stage>"] ?? "<premium-literal>"
```
The premium literal is the lint-guarded fallback; the resolved override wins when present. The D3 drift lint (`test/m86-lint-unwrap-fallback.test.js`) validates the `??` form, the bracket key, and all fallback literals.

---

## Competition Mode (M82/M84)

On upstream phases (partition / milestone / discuss / design-decompose), an Opus solution-space probe auto-decides whether to compete. If it fires: 3 parallel producers (opus) → a judge (fable for partition, different-model blind for subjective) → a finalizer. Contract: `.gsd-t/contracts/competition-mode-contract.md` v1.0.0.

---

## Plan Hardening (M83)

The `plan` phase runs two blocking gates before execute:
1. **Traceability gate** (`gsd-t traceability-gate`) — every AC binds to a code path + a killing test.
2. **Pre-mortem** (fable, fresh-context) — adversarial prediction of edge-case/NFR/dead-deliverable failures; each → a required test.

Contract: `.gsd-t/contracts/plan-hardening-contract.md` v1.0.0.

---

## Universal Trace + Audit Logging (M100)

Two logging streams are now a framework DEFAULT, scaffolded by `gsd-t-init` and enforced structurally by `gsd-t-verify`:

| Stream | Definition | Default rule | Envelope |
|--------|-----------|---------------|----------|
| **Trace** | Transient, PII-barred, toggleable DEBUGGING SIGNAL STREAM | Default for EVERY project — no opt-out | `ts`/`category`/`decision`/`detail` (+ optional `key`/`status`/`data`) |
| **Audit** | Durable, append-only, admin-queryable ACCOUNTABILITY record | Default EXCEPT explicit opt-out recorded at `.gsd-t/audit-optout.json` | `ts`/`actor`/`action`/`target`/`before`/`after`/`context` |

- **Storage** — `bin/gsd-t-logging-scaffolder.cjs` detects the stack (has-DB → table; no-server → local SQLite/JSONL) and STOPS for human approval; never silently picks a backend.
- **Schema distillation** — `bin/gsd-t-trace-distill.cjs` (categories) + `bin/gsd-t-audit-distill.cjs` (actions + opt-out writer) distill the per-project concrete schema from the project's own plan, never confabulated. Contract: `.gsd-t/contracts/logging-schema-distillation-contract.md`.
- **Enforcement** — `bin/gsd-t-logging-envelope-check.cjs`, registered into `gsd-t-verify-gate.cjs`, checks both envelopes structurally (never a hardcoded category/action value) and blocks any collapse of the two streams into one.
- **Brownfield migration** — `gsd-t migrate-logging <projectDir>` (`bin/gsd-t-migrate-logging.cjs`) scaffolds both streams into an EXISTING project additively; proven non-destructive on a throwaway fixture (`test/m100-d5-migration-fixture.test.js`).
- **Pilot** — UMI-Automation (separate repo) is the greenfield build-into proof: trace on Grain/Airtable/Anthropic/Apify REST calls, audit on PodCoach draft-approval, both distilled from UMI's real `docs/plan.md`.

Contracts: `trace-logging-contract.md`, `audit-logging-contract.md`, `logging-schema-distillation-contract.md`, `logging-scaffold-seam-contract.md`, `logging-verify-gate-contract.md`.

---

## Wave Diagram

```
/gsd-t-wave
  ├── gsd-t-execute.workflow.js
  │     preflight → brief → file-disjointness → parallel(domain workers) → integrate → verify-gate
  └── gsd-t-verify.workflow.js
        preflight → verify-gate (tsc+lint+tests+knip) → CI-parity (M57) → test-data-purge (M58)
          → parallel[ /code-review ultra | Red Team (fable) | QA (sonnet) ] → synthesis
```

---

## Version History (recent)

| Version | Milestone | Key capability |
|---------|-----------|----------------|
| 4.20.10 | M100 | **Universal Trace + Audit Logging.** Two logging streams become GSD-T framework defaults, each a default except explicit opt-out (mirrored convention): trace (transient debug signal — opt out via `.gsd-t/trace-optout.json` for a stateless CLI/library with no runtime data-flow) and audit (durable append-only accountability record — opt out via `.gsd-t/audit-optout.json` declared in the project's own CLAUDE.md). Stack-adaptive human-approval-gated storage scaffolder; per-project schema distillation grounded in the project's own plan (never confabulated); structural envelope enforcement in `gsd-t-verify` with a hard no-collapse boundary; brownfield `gsd-t migrate-logging` (additive, proven non-destructive on a throwaway fixture); piloted end-to-end on UMI-Automation (separate repo) — trace on Grain/Airtable/Anthropic/Apify, audit on PodCoach draft-approval. Verify hardened the audit immutability across 3 fix-cycles; documented known limitation (trigger-based defense-in-depth, not tamper-proof vs direct DB-file write — backlog #48). |
| 4.19.10–4.19.14 | `/gsd-t-stories` | New standalone command: generate a **dev-team handoff document in the Tekyz user-stories format** from any source (scan register / requirements doc / design contract / reverse-engineered codebase). Emits front matter → §1 Application Flow Overview → §2 User Stories grouped under Epics (each: `PREFIX-NNN` id, Story `As a…I want…so that…`, numbered Workflow, grouped Acceptance Criteria, per-story Flow Diagram, Mapped Test Cases table with Positive/Negative/Edge types) → §3 Scope Summary. Diagrams are authored as **Mermaid but embedded as rendered PNGs** (via `@mermaid-js/mermaid-cli`), matching the sample's embedded-image flow charts. Output → `share/<Repo>-user-stories.md` (+ optional `.docx` via pandoc). Format reverse-engineered from the Tekyz Compass sample; bundled reference at `templates/playbooks/tekyz-user-stories-format.md`. Distinct from `/gsd-t-prd` (internal `docs/prd.md`). **v4.19.11:** semantic role-based coloring. **v4.19.12:** aspect-ratio "contain" fit. **v4.19.13:** label-reserve for height-constrained diagrams. **v4.19.14:** one-story-per-page pagination, test-case grid coloring, in-image diagram titles. |
| 4.18.10 | Scan consolidation + repo adoption | **Scan register organized by TD TYPE within each severity** (Security/Vulnerability → Dead Code → Duplication → Data-Integrity → Performance → Contract-Drift → Testing → Other) and a new **🧩 Consolidation Opportunities** section appended at the END: an opus + graph-assisted phase that clusters high-confidence groups of TDs sharing a root (duplicate-function families, batch dead-code deletions, a guard missing across N sites) into single-workstream candidates (CG-N with members/root/action/effort). **`/gsd-t-init-scan-setup` gains Step 0 "Adopt a Foreign Repo"** — sanitizes imported repos (settings reconciled against global, CLAUDE.md regenerated from fresh scan, no execution of foreign/stale workflow scripts) so a repo built by others runs correctly on your machine; plus a **Step 4a post-scan completeness check** that catches a hand-driven/incomplete scan and re-invokes the packaged 8-phase Workflow. |
| 4.17.10 | `/gsd-t-estimate` v2 | **Generalized + supervised + adversarial.** Input broadened from scan-only to **any structured work document** (scan register, new-feature/new-app requirements doc, PRD-in) — line-items become findings OR requirements. **Numbering hygiene** replaces renumber-to-TD-1: renumber only when numbering is absent/non-sequential/doesn't-start-at-1, and **preserve hierarchical numbering** (`1`/`1.1`/`1.1.1`). **Estimate Adjustments** (Step 2.5) broadened from familiarization-only to **familiarization + R&D/unknown-approach/spike risk**. **Rate + sheet template + factors parameterized** (default Tekyz). **Human-in-the-loop:** judgment phases (sizing, adjustments, PRD, Red Team) PAUSE for operator review; mechanical phases flow-but-show. New **Step 8 Estimate Red Team** challenges under-sized items, missing line-items, optimistic multipliers, cross-check integrity — **operator is the final arbiter** (argue until concede or a definitive ruling; Red Team then grudgingly accepts and MAY document overridden objections to `share/<Repo>-estimate-redteam-notes.md`). |
| 4.16.10 | `/gsd-t-estimate` | New standalone command: turn a completed scan (`.gsd-t/techdebt.md`) into a **Tekyz client estimate** (Google Sheet — T-Shirt Size + Team Mix) and a matching **PRD** deliverable. Encodes the 7-phase Tekyz playbook proven on HILO Figma ATOS (21 criticals → 32.73 eng-days → $13,090–$16,362): client renumber-to-TD-1, T-shirt sizing (XS.25→XXL7, FE+BE independent), new-team familiarization bump (bump SIZE not the multiplier, never cross the M→L 3× cliff), Google Sheet write via a throwaway service-account + JWT (gcloud's spreadsheets scope is Google-blocked), FR↔TD-crosswalk PRD with an estimate-not-quote disclaimer, three-total reconciliation. Playbook bundled at `templates/playbooks/`. |
| 4.15.10 | Scan fixes | (1) **Scan builds the graph index when absent** instead of silently grep-falling-back. The wired path was documented "build index if absent, then query" but the build step was never wired — so on any project without a pre-built index (the common case) scan never used the graph (observed on hilo-figma-atos: a 30M-token scan grep-fell-back purely because the index was never built). Now the wired branch runs `gsd-t graph index`, re-probes, and falls back only if the build fails. (2) **Repo-labeled `share/` export (#47):** the last scan step copies the living docs + scan reports into `share/<file>-<repo>.md` so files shared across projects are distinguishable; internal files keep fixed names (zero blast radius); prior outputs archived to `.gsd-t/scan/archive/<name>-YYYYMMDD-HHMM.md` for diffing. |
| 4.14.10 | M99 | Graph Observability & Consolidation. All graph artifacts (`graph.db` + WAL/SHM, `index.scip`, `index-python.scip`, telemetry `logs/`) consolidated under `.gsd-t/graphDB/` via a copy-verify-swap migration shim (WAL-checkpoint before copy, idempotent, interruption-safe, never-orphan). The graph-vs-grep DECISION is now observable: a toggleable append-only telemetry ledger records every graph query (hit/miss/graph-unavailable/tier/latency/stale-reindex), every grep-intercept decision (structural→graph-replaced vs text→passthrough), every read-intercept decision, and each workflow's wiring mode (WIRED/fallback-announced/disabled) — surfaced through `gsd-t graph metrics` (hit-vs-passthrough ratio, fallback-rate, p50/p95 latency, tier mix, per-consumer/per-verb, plus the `fallbackAnnouncedDespiteHit` north-star contradiction count). Built to make a NiceNote-class invisible grep-fallback impossible to hide again. Verify caught + fixed 3 real HIGH bugs (migration WAL data-loss on interruption, rollup prototype-pollution crash, SCIP files written outside graphDB). |
| 4.13.12 | Scan fix | Scan graph probe no longer silently falls back to grep-mode when the graph is live. The probe ran a CLI through a haiku agent then `JSON.parse`'d its free-text reply; haiku fenced the JSON in ```` ```json ```` → parse threw → graph-unavailable → grep-mode (graph was up). Fix: schema-validated probe (StructuredOutput, fence-proof) + global-bin fallback + reason surfaced in the fallback log + regression test. Found on a real NiceNote scan. |
| 4.13.11 | M98 fix | `gsd-t graph body <fn>` is now reachable from the front door. M98 shipped the `body` slice logic in the query CLI + the Read-intercept hook, but the top-level `gsd-t graph` router had no `case "body"` — so the user-facing command fell through to "Unknown graph subcommand" (the M98 test only exercised the CLI directly). Fix: one router case + a front-door regression test. Found by checking real binvoice. |
| 4.13.10 | M98 | The graph now SERVES CODE, not just indexes it. A new `gsd-t graph body <funcId\|symbol>` verb returns a single function's SOURCE — sliced LIVE from disk by line range (never stored; always fresh because the query path re-indexes a stale file first) — with its imports, class header (for methods), and caller list attached. Measured on real binvoice: one function (`selectCommentId`, 43 lines) vs the whole 1,334-line file = **21× fewer characters**. The extractor now records each function's END line (`nodes.end_line`, idempotently migrated onto pre-M98 graphs); ambiguous bare symbols return candidates, never a merged body. A new PostToolUse `Read`-intercept hook (`scripts/gsd-t-read-intercept.js`) AUGMENTS a structural code read (one whose offset/limit lands inside a known function) with a pointer to the precise `graph body` slice — **default is pass-through** (a bare/edit-intent read is never shrunk), fail-open, registered by `gsd-t install`. |
| 4.12.10 | M97 | The code graph is now the DEFAULT for ambient code-reading, not just GSD-T commands. A PostToolUse hook (`scripts/gsd-t-graph-intercept.js`) on Claude's built-in `Grep` classifies each search: a STRUCTURAL query (a bare symbol / a call shape / an import) is answered from the code graph and REPLACES the grep output the model sees (via `updatedToolOutput`, original hits kept beneath); a TEXT search (string/regex/phrase) passes through untouched. Conservative classifier, fail-open, never calls Grep/Read (no loop), no-op when a project has no graph. Registered into settings.json by `gsd-t install`. **This release also fixed 3 bugs that made the call-graph EMPTY on real projects:** the CLI build path passed the wrong `scip` arg (so `gsd-t graph index` skipped resolution → 0 resolved edges on every real run); method names after `#` (`Class#method()`) weren't extracted; and a funcId `@line`-suffix mismatch dropped who-calls results. Plus the freshness hash-mismatch fix (md5 vs sha256 made every query re-index the whole repo — `gsd-t graph status` 30s→0.38s) and build-output exclusion (`dist-local`/`dist-test`/`.venv`). binvoice now: 2,579 resolved call edges; `who-calls` returns real callers. |
| 4.10.11 | M96 | Code graph runs in every project. The graph runtime's native engines (better-sqlite3 store + tree-sitter floor parsers) are now real `dependencies`, and `bin/gsd-t-require-store.cjs` resolves them from the GSD-T global package when a copied tool runs inside a project that lacks them — fixing a silent empty-graph (0 nodes/edges that looked like a successful build) and failing loud if a native dep is genuinely missing. Proven on binvoice (a real non-GSD-T project): graph builds 471 files / 43,309 edges; `blast-radius` returns real dependents (the consumer reads the graph, not grep). |
| 4.10.10 | M94 + M95 | Persistent code graph + real SCIP call-graph resolution. A persistent all-local on-disk index (files / functions / imports / call graph) with a deterministic no-grep-fallback query CLI; the precise tier now reads scip-typescript's `index.scip` and resolves cross-file call edges (verified on real Atos: the test→impl verb returns 164 resolved edges, was 0). The graph runtime is in `PROJECT_BIN_TOOLS`, so `update-all` copies the query CLI into every project's `bin/` and the wired consumers (execute/wave disjointness, debug, quick, impact, plan, scan) read the project graph instead of grep. `gsd-t install` auto-installs the SCIP indexers; `gsd-t doctor` reports them. Zero-dep is now a guiding principle, not a hard rule. |
| 4.9.11 | M93 | Brevity Guard — concise, answer-first replies are now ENFORCED, not just requested. A blocking `Stop` hook (`gsd-t-brevity-guard.js`) catches answer-mode preamble/process-narration (action-mode intent-first is still allowed) and blocks it before you read it; a Reader Contract in CLAUDE-global + the subagent prompts sets the default; a `gsd-t-jargon-lint.cjs` flags unglossed jargon in docs. Fail-open by design (never gags legitimate work). |
| 4.9.10 | M92 (#44a) | Understand-Before-Build, the paradigm half — GSD-T now prefers the SMALLEST change: M90's §2 arch-trigger gets a cheaper-first look→smallest→spike→defer response (look is the default; spike demoted), verify can SAY "we made it smaller" (deterministic `git diff` shrink-metric + additive `shrink` verdict dimension), and the milestone/quick default is inverted so ceremony is opt-in. No graph (that's #44b, gated). |
| 4.8.10 | M91 (M87+M88) | PseudoCode Source-of-Truth — intention-first behavior map as the milestone source-of-truth: `[RULE]` guard-map verify gate, section-citation traceability, two-altitude flow, + 4 deterministic M88 gates (sign-off `isDefined`, build→map derivation, triad-consumption seam, divergence-grammar round-trip) |
| 4.7.11 | #40 | Deterministic domain archive+sweep at complete-milestone (`bin/gsd-t-archive-domains.cjs`) — stops stale-domain accumulation |
| 4.7.10 | M90 | The Unproven-Assumption Doctrine — factual classifier + loop-ledger non-convergence halt + architectural trigger, wired fail-closed |
| 4.5.10 | M86 | Model Profiles (standard/pro/premium) — per-project tier-spend switch |
| 4.4.10 | M85 | Fable 5 tier + single-source model-tier policy (`bin/gsd-t-model-tier-policy.cjs`) |
| 4.0.10 | M61 | Native Workflow orchestration — Workflow runtime owns spawning |
| 3.29.10 | M59 | Timestamp precision in progress.md + date-guard hardening |
