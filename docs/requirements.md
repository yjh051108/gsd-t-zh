# Requirements — GSD-T Framework (@tekyzinc/gsd-t)

## Last Updated: 2026-03-09 (Scan #9 — M17 complete)

## Functional Requirements

| ID | Requirement | Priority | Status | Tests |
|----|-------------|----------|--------|-------|
| REQ-001 | CLI installer with install, update, status, doctor, init, uninstall, update-all, register, changelog subcommands | P1 | complete | manual CLI testing |
| REQ-002 | 41 GSD-T workflow slash commands for Claude Code (incl. QA agent, health, pause) | P1 | complete | validated by use |
| REQ-003 | 4 utility commands (gsd smart router, branch, checkin, Claude-md) | P1 | complete | validated by use |
| REQ-004 | Backlog management system (7 commands: add, list, move, edit, remove, promote, settings) | P1 | complete | validated by use |
| REQ-005 | Contract-driven development with domain partitioning | P1 | complete | validated by use |
| REQ-006 | Wave orchestration (full cycle: partition → discuss → plan → impact → execute → test-sync → integrate → verify → complete) | P1 | complete | validated by use |
| REQ-007 | Heartbeat system via Claude Code hooks (9 events, JSONL output, 7-day cleanup) | P2 | complete | hook scripts installed |
| REQ-008 | Automatic update check against npm registry (1h cache, background refresh) | P2 | complete | CLI + slash command |
| REQ-009 | Document templates for living docs (9 templates with token replacement) | P1 | complete | used by gsd-t-init |
| REQ-010 | Smart router — natural language intent → command routing | P2 | complete | validated by use |
| REQ-011 | Triage and merge — auto-review, score, merge safe GitHub branches | P2 | complete | validated by use |
| REQ-012 | QA Agent — test-driven contract enforcement spawned in 10 phases | P1 | complete | validated by use |
| REQ-013 | Wave orchestrator — agent-per-phase execution with fresh context windows | P1 | complete | validated by use |
| REQ-014 | Token Efficiency — QA refactored (removed from partition/plan, Task subagent for execute/integrate, inline for test-sync/verify) | P2 | complete (M10) | validated by use |
| REQ-015 | Execution Quality — Deviation Rules (4-rule, 3-attempt), per-task commits, wave spot-check | P2 | complete (M11) | validated by use |
| REQ-016 | Planning Intelligence — CONTEXT.md from discuss, plan fidelity enforcement, plan validation subagent, REQ traceability | P2 | complete (M12) | validated by use |
| REQ-017 | Tooling & UX — gsd-t-tools.js state CLI, gsd-t-statusline.js context bar, gsd-t-health command, gsd-t-pause command | P2 | complete (M13) | validated by use |
| REQ-018 | Execution Event Stream — append-only JSONL event log (.gsd-t/events/) capturing every command invocation, subagent spawn, phase transition, and decision with schema: ts, event_type, command, phase, agent_id, parent_agent_id, trace_id, reasoning, outcome | P1 | complete (M14) | test/event-stream.test.js |
| REQ-019 | Outcome-Tagged Decision Log — Decision Log entries prefixed with [success], [failure], [learning], [deferred] outcome tags for all new entries written by execute, debug, complete-milestone | P1 | complete (M14) | validated by use |
| REQ-020 | Pre-Task Experience Retrieval — execute and debug retrieve [failure]/[learning] Decision Log entries matching the current domain/task before spawning subagents (Reflexion pattern); warning injected into subagent prompt if relevant past failures found | P1 | complete (M14) | validated by use |
| REQ-021 | Milestone Distillation — complete-milestone runs a distillation step: scans the event stream for patterns found ≥3 times, proposes concrete constraints.md / CLAUDE.md rule additions, user confirms before write | P2 | complete (M14) | validated by use |
| REQ-022 | gsd-t-reflect command — reads .gsd-t/events/*.jsonl for the current milestone, generates structured retrospective (what worked, what failed, patterns found, proposed memory updates), outputs to .gsd-t/retrospectives/YYYY-MM-DD-{milestone}.md | P2 | complete (M14) | validated by use |
| REQ-023 | Real-Time Agent Dashboard — gsd-t-visualize command starts a zero-dependency SSE server watching .gsd-t/events/ and opens gsd-t-dashboard.html in the browser; dashboard renders agent hierarchy (React Flow + Dagre via CDN) with live event overlay; all 6 interaction patterns visualized (wave/execute, parallel domains, scan, brainstorm, debug, quick/error) | P2 | complete (M15) | test/dashboard-server.test.js (23 tests) |
| REQ-024 | Scan Schema Extraction — gsd-t-scan detects and parses ORM/schema definition files (TypeORM entities, Prisma schema, Drizzle schema, Mongoose models, SQLAlchemy models, raw SQL migrations) to extract: entity names, field names and types, primary/foreign keys, and relationships; outputs structured schema data consumed by REQ-025 ER diagram generation | P1 | complete (M17) | test/scan.test.js + verify-gates.js |
| REQ-025 | Scan Diagram Generation — gsd-t-scan generates Mermaid diagram definition files (.mmd) for 6 diagram types derived from codebase analysis: (1) System Architecture — C4-style context diagram of services, databases, queues, and external integrations; (2) Application Architecture — layered diagram showing framework layers (controllers/guards/services/repositories) and their boundaries; (3) Workflow Diagram — state machine derived from status enums and state transition logic; (4) Data Flow Diagram — flowchart tracing data from user input through validation, persistence, async queues, and workers; (5) Sequence Diagram — request/response flow for the most critical API endpoint detected; (6) Database Schema — ER diagram generated from REQ-024 schema extraction | P1 | complete (M17) | test/scan.test.js + verify-gates.js |
| REQ-026 | Scan Diagram Rendering — diagram definitions from REQ-025 are rendered to SVG using the configured backend (REQ-028); rendered SVGs are embedded inline in the HTML report; rendering backend is selected in priority order: Mermaid CLI → D2 → Kroki HTTP; if all backends fail a graceful fallback generates a "diagram unavailable" placeholder without blocking the report | P1 | complete (M17) | test/scan.test.js + verify-gates.js |
| REQ-027 | Scan HTML Report — gsd-t-scan generates a self-contained HTML report (scan-report.html) containing: (a) sidebar navigation with scrollspy; (b) summary metric cards (files scanned, LoC, tech debt count by severity, test coverage %, outdated deps, API endpoint count); (c) domain health cards with file inventory and health score; (d) 6 diagram sections (REQ-025/026) each with title, type badge, inline SVG, expand-to-fullscreen button with scroll-to-zoom, and descriptive note; (e) tech debt register table with severity badges; (f) key findings with actionable recommendations; report uses dark theme, no external CDN required after generation | P1 | complete (M17) | test/scan.test.js + verify-gates.js |
| REQ-028 | Scan Document Export — scan output exportable to two additional formats: (a) DOCX via Pandoc (GPL v2+) — converts scan-report.md + embedded images to .docx; upload to Google Drive auto-converts to Google Docs; (b) PDF via md-to-pdf (MIT) + Puppeteer — renders markdown with CSS styling to print-quality PDF; both export formats are triggered by optional flags (--export=docx, --export=pdf) and are independent of HTML report generation | P2 | complete (M17) | test/scan.test.js + verify-gates.js |
| REQ-029 | Diagram Rendering Toolchain — three rendering backends supported, each free and open source, selected automatically based on availability: (1) Primary — Mermaid CLI (mmdc, @mermaid-js/mermaid-cli, MIT, npm) renders .mmd files to SVG via headless Chromium; (2) Enhanced — D2 (MPL-2.0, terrastruct/d2, Go binary) as optional renderer for architecture and dataflow diagrams — uses dagre/ELK/neato layouts (TALA excluded, paid); (3) Fallback — Kroki HTTP API (MIT, yuzutech/kroki) renders any supported format via single HTTP POST to kroki.io (public free tier) or self-hosted Docker instance | P2 | complete (M17) | test/scan.test.js + verify-gates.js |
| REQ-030 | MCP Diagram Server Support — gsd-t-scan supports optional MCP-based diagram generation when registered MCP servers are detected in Claude Code settings: diagram-bridge-mcp (MIT, tohachan) selects optimal format and renders via Kroki; C4Diagrammer (MIT, jonverrier) specialized for existing codebase → C4 architecture diagrams; mcp-mermaid (MIT, hustcc) for 22 Mermaid diagram types; MCP path is preferred over CLI when available | P3 | complete (M17) | test/scan.test.js + verify-gates.js |

| REQ-031 | Per-Task Telemetry Collection — metrics-collector.js emits structured records to task-metrics.jsonl with weighted signal taxonomy (5 signal types), pre-flight intelligence check warns on domain failure patterns | P1 | complete (M25) | test/metrics-collector.test.js |
| REQ-032 | Milestone Rollup & Process ELO — metrics-rollup.js aggregates task-metrics into rollup.jsonl with first_pass_rate, ELO scoring (K=32), trend comparison, 4 detection heuristics (first-pass-failure-spike, rework-rate-anomaly, context-overflow-correlation, duration-regression) | P1 | complete (M25) | test/metrics-rollup.test.js |
| REQ-033 | Metrics Dashboard Panel — Chart.js trend line (first_pass_rate over milestones), domain health heatmap, ELO display in existing dashboard via GET /metrics endpoint | P2 | complete (M25) | test/dashboard-server.test.js (extend) |
| REQ-034 | gsd-t-metrics Command — 50th command reads task-metrics.jsonl + rollup.jsonl, displays metrics summary, ELO, signal distribution, domain breakdown, trend comparison, heuristic warnings | P1 | complete (M25) | validated by use |
| REQ-035 | Process ELO in Status — gsd-t-status displays current ELO score and quality budget summary from rollup.jsonl | P2 | complete (M25) | validated by use |

| REQ-036 | Declarative Rule Engine — bin/rule-engine.js loads rules from rules.jsonl, evaluates triggers against task-metrics with 8 operators (gt, gte, lt, lte, eq, neq, in, pattern_count), tracks activation counts, flags inactive rules, consolidates related rules | P1 | planned | test/rule-engine.test.js |
| REQ-037 | Patch Template System — patch-templates.jsonl maps rule triggers to file edits (append, prepend, insert_after, replace), templates reference target files and edit content | P1 | planned | test/rule-engine.test.js |
| REQ-038 | Patch Lifecycle Manager — bin/patch-lifecycle.js manages 5-stage lifecycle (candidate->applied->measured->promoted->graduated) with promotion gate (>55% improvement over 2+ milestones) and graduation (3+ milestones sustained) | P1 | planned | test/patch-lifecycle.test.js |
| REQ-039 | Active Rule Injection in Execute — gsd-t-execute.md injects firing rules (max 10 lines) into subagent prompts before task dispatch | P1 | planned | validated by use |
| REQ-040 | Rule-Based Pre-Mortem in Plan — gsd-t-plan.md Step 1.7 enhanced with getPreMortemRules to surface historical rule matches for domain types | P2 | planned | validated by use |
| REQ-041 | Distillation Extension — gsd-t-complete-milestone.md distillation step extended with rule evaluation, patch candidate generation, promotion gate check, graduation, consolidation, and quality budget governance | P1 | planned | validated by use |
| REQ-042 | Quality Budget Governance — per-milestone rework ceiling (default 20%), auto-tightens constraints (force discuss, require contract review, split large tasks) when exceeded | P2 | planned | validated by use |

| REQ-043 | Global Sync Manager — bin/global-sync-manager.js reads local metrics, writes global aggregated files to ~/.claude/metrics/, provides APIs for global rollup, global rules, signal distribution comparison, universal rule promotion | P1 | planned | test/global-sync-manager.test.js |
| REQ-044 | Cross-Project Rule Propagation — gsd-t-version-update-all syncs global rules (universal or promotion_count >= 2) to all registered projects as candidates | P1 | planned | test/global-rule-sync.test.js |
| REQ-045 | Universal Rule Promotion — rules promoted in 3+ projects marked universal, 5+ projects become npm distribution candidates shipped in examples/rules/ | P1 | planned | test/global-sync-manager.test.js |
| REQ-046 | Cross-Project Signal Comparison — gsd-t-metrics --cross-project displays signal-type distribution comparison across registered projects | P2 | planned | validated by use |
| REQ-047 | Global ELO & Rankings — gsd-t-status displays global ELO score and cross-project rank when global metrics exist | P2 | planned | validated by use |
| REQ-048 | Global Rule Promotion on Milestone Completion — gsd-t-complete-milestone copies promoted rules to global-rules.jsonl and updates global rollup after local promotion | P1 | planned | validated by use |
| REQ-049 | E2E Enforcement Rule — when playwright.config.* or cypress.config.* exists, ALL test-running commands (execute, quick, debug, test-sync, integrate, verify, complete-milestone) MUST run the full E2E suite. Unit-only results are NEVER sufficient. QA subagent prompts explicitly mandate E2E detection and execution. | P1 | complete | enforced in 7 command files + CLAUDE.md + pre-commit-gate contract |
| REQ-050 | Functional E2E Test Quality Standard — Playwright specs MUST verify functional behavior (state changes, data flow, content updates after actions), NOT just element existence (isVisible, toBeEnabled). Shallow layout tests that would pass on an empty HTML page are flagged and block verification. QA subagent audits for shallow tests. | P1 | complete | enforced in execute, qa, test-sync, verify, quick, debug, integrate, complete-milestone + global CLAUDE.md + CLAUDE-global template |
| REQ-051 | Document Ripple Completion Gate — when a change affects multiple files, identify the full blast radius BEFORE starting, complete ALL updates in one pass, and only report completion after every downstream document is updated. Partial delivery is never acceptable. The user should never need to ask "did you update everything?" | P1 | complete | enforced in global CLAUDE.md + CLAUDE-global template + project CLAUDE.md |
| REQ-052 | Doc-Ripple Subagent — dedicated agent auto-spawned after code-modifying commands (execute, integrate, quick, debug, wave) that analyzes git diff, identifies full blast radius of affected documents, and spawns parallel subagents to update them. Produces manifest audit trail. Threshold logic skips trivial changes. | P1 | complete | M28: contract ACTIVE, command file, 43 tests, wired into execute/integrate/quick/debug/wave |
| REQ-053 | Debug Ledger Protocol — structured JSONL ledger (.gsd-t/debug-state.jsonl) persists hypothesis/fix/learning entries across debug sessions. Supports read, append, compact (at 50KB), anti-repetition preamble generation, and clear. | P1 | complete | M29: bin/debug-ledger.js, test/debug-ledger.test.js (46 tests) |
| REQ-054 | Headless Debug-Loop — `gsd-t headless --debug-loop` runs test-fix-retest cycles as separate `claude -p` sessions with fresh context each. External loop controller (pure Node.js, zero AI context). Escalation tiers: sonnet 1-5, opus 6-15, STOP 16-20. --max-iterations enforced externally. | P1 | complete | M29: bin/gsd-t.js headless extension, test/headless-debug-loop.test.js (37 tests) |
| REQ-055 | Anti-Repetition Preamble — each debug-loop iteration injects a preamble listing all failed hypotheses, current narrowing direction, and tests still failing. Prevents repeat of eliminated approaches. | P1 | complete | M29: bin/debug-ledger.js generateAntiRepetitionPreamble, test/debug-ledger.test.js |
| REQ-056 | Debug-Loop Command Integration — execute, wave, test-sync, verify, and debug commands delegate to headless debug-loop after 2 in-context fix attempts fail. Preserves existing try-twice behavior for quick fixes. | P1 | complete | M29: 5 command files (execute, debug, wave, test-sync, verify) |
| REQ-057 | Stack Rule Templates — best practice rule files in `templates/stacks/` for React, TypeScript, and Node.js API. Each file follows a standard structure (mandatory framing, numbered sections, GOOD/BAD examples, verification checklist) and stays under 200 lines. Universal templates (`_` prefix) always injected; stack-specific templates injected when detected. | P1 | complete | M30: templates/stacks/ (4 files: _security.md, react.md, typescript.md, node-api.md) |
| REQ-058 | Stack Detection Engine — auto-detect project tech stack from manifest files (package.json, requirements.txt, go.mod, Cargo.toml) at subagent spawn time. Match detected stacks against available templates. Inject matched rules into subagent prompts with mandatory enforcement framing. Resilient: skip silently if no templates exist or no matches found. | P1 | complete | M30: 5 command files (execute, quick, integrate, wave, debug) |
| REQ-059 | Stack Rule QA Enforcement — QA subagent prompts include stack rule compliance validation. Stack rule violations have the same severity as contract violations — they fail the task, not warn. Report format includes "Stack rules: compliant/N violations". | P1 | complete | M30: execute QA prompt + all 5 commands |
| REQ-060 | Quality North Star Persona — project CLAUDE.md can define a `## Quality North Star` section (1-3 sentences) with a project quality identity. gsd-t-init auto-detects preset (library/web-app/cli) or prompts user. gsd-t-setup offers persona config for existing projects. Persona is injected at subagent spawn time; skips silently if section absent (backward compatible). | P2 | complete | M32: templates/CLAUDE-project.md, gsd-t-init.md, gsd-t-setup.md |
| REQ-061 | Design Brief Generation — during partition, if UI/frontend signals detected (React/Vue/Svelte/Flutter, CSS/SCSS, component files, or Tailwind config), generate `.gsd-t/contracts/design-brief.md` with color palette, typography, spacing, component patterns, layout principles, interaction patterns, and tone/voice. Skip for non-UI projects. Do not overwrite existing briefs. Referenced in plan for UI task descriptions. | P2 | complete | M32: gsd-t-partition.md, gsd-t-plan.md, gsd-t-setup.md |
| REQ-062 | Exploratory Testing Blocks — after scripted tests pass, if Playwright MCP is registered, QA agents get 3 minutes and Red Team gets 5 minutes of interactive exploration using Playwright MCP. All findings tagged [EXPLORATORY] in qa-issues.md and red-team-report.md. Feeds into M31 QA calibration as separate category. Silent skip when Playwright MCP absent. Injected into execute, quick, integrate, debug. | P2 | complete | M32: gsd-t-execute.md, gsd-t-quick.md, gsd-t-integrate.md, gsd-t-debug.md |

## Technical Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| TECH-001 | Zero external npm dependencies | P1 | complete |
| TECH-002 | Node.js >= 16 compatibility | P1 | complete |
| TECH-003 | Cross-platform support (macOS, Linux, Windows) | P1 | complete |
| TECH-004 | Semantic versioning with git tags | P1 | complete |
| TECH-005 | Pre-Commit Gate enforced on every commit | P1 | complete (manual, not automated) |
| TECH-006 | Symlink protection on all file write operations | P1 | complete |
| TECH-007 | Input validation on project names, versions, paths, session IDs | P1 | complete |
| TECH-008 | prepublishOnly gate — `npm test` runs before `npm publish` | P1 | complete (M8) |
| TECH-009 | Mermaid CLI (@mermaid-js/mermaid-cli, MIT) is the primary diagram renderer — requires Node.js (already required by GSD-T); installed on demand if absent; renders .mmd → SVG/PNG via headless Chromium (Puppeteer peer dependency) | P1 | complete (M17) |
| TECH-010 | D2 diagram renderer (MPL-2.0, terrastruct/d2) is optional — detected by `which d2`; used in preference to Mermaid CLI for architecture and dataflow diagram types when present; free layouts only: dagre, ELK, neato | P2 | complete (M17) |
| TECH-011 | Kroki HTTP API (MIT, yuzutech/kroki) is the zero-install fallback renderer — single HTTP POST, no local dependencies; defaults to public kroki.io; configurable to self-hosted instance via KROKI_URL env var | P2 | complete (M17) |
| TECH-012 | Pandoc (GPL v2+) used for DOCX and HTML document export; detected by `which pandoc`; --export flags silently skip if absent with a warning in report output | P2 | complete (M17) |
| TECH-013 | All diagram and export tooling must be free and open source (MIT, MPL-2.0, GPL, or equivalent OSI-approved license) with no paid tiers, subscriptions, or per-request API fees required for core functionality | P1 | complete (M17) |

## Non-Functional Requirements

| ID | Requirement | Metric | Status |
|----|-------------|--------|--------|
| NFR-001 | CLI install completes quickly | < 5s | complete |
| NFR-002 | No runtime crashes on missing files | graceful fallback | complete |
| NFR-003 | Command files are pure markdown (no frontmatter) | 100% compliance | complete |
| NFR-004 | Heartbeat auto-cleanup prevents unbounded growth | 7-day TTL | complete |
| NFR-005 | Update check is non-blocking after first run | background process | complete |
| NFR-006 | Scan HTML report renders all diagrams in browser within 5 seconds of opening | < 5s render | complete (M17) |
| NFR-007 | Scan HTML report is self-contained after generation — all SVG diagrams are embedded inline; no external CDN dependencies required to view the report | 100% offline-capable | complete (M17) |
| NFR-008 | Diagram generation degrades gracefully — if the primary renderer is unavailable the next backend is tried automatically; the scan report is always produced even if all renderers fail (placeholder shown instead of diagram) | zero blocking failures | complete (M17) |
| NFR-009 | Schema extraction completes within the scan time budget — ORM/schema file parsing adds no more than 10% to total scan duration | ≤ 10% overhead | complete (M17) |

## Test Coverage

| Requirement | Test File | Test Name | Status |
|-------------|-----------|-----------|--------|
| REQ-001 | test/helpers.test.js, test/filesystem.test.js | CLI subcommand + helper tests | passing (64 tests) |
| REQ-006 | test/cli-quality.test.js | Wave-related function tests (buildEvent, etc.) | passing (22 tests) |
| REQ-007 | test/security.test.js | Heartbeat security (scrubSecrets, scrubUrl) | passing (30 tests) |
| REQ-002–005, 008–013 | manual | Workflow validation by use | passing |

**Total automated tests**: 125 across 4 test files (M4: 64, M5: 30, M6: 22, M9: 9). Runner: `node --test` (zero dependencies).

## Requirements Traceability (updated by plan phase — M14)

| REQ-ID  | Requirement Summary                                         | Domain        | Task(s)         | Status  |
|---------|-------------------------------------------------------------|---------------|-----------------|---------|
| REQ-018 | Execution Event Stream — JSONL events/ with 9-field schema  | event-stream  | Task 1, Task 2, Task 3, Task 4 | complete |
| REQ-019 | Outcome-Tagged Decision Log — [success]/[failure] prefixes  | learning-loop | Task 1, Task 2  | complete |
| REQ-020 | Pre-Task Experience Retrieval — Reflexion pattern           | learning-loop | Task 1, Task 2  | complete |
| REQ-021 | Milestone Distillation — patterns → CLAUDE.md proposals     | reflect       | Task 1          | complete |
| REQ-022 | gsd-t-reflect command — retrospective from events/          | reflect       | Task 2, Task 3  | complete |
| REQ-023 | Real-Time Agent Dashboard — SSE server + React Flow dashboard + gsd-t-visualize command | server, dashboard, command | server T1, dashboard T1, command T1, T2, T3 | complete (M15) |

| REQ-024 | Scan Schema Extraction — ORM/schema parser → structured entity data       | scan-schema      | pending         | planned |
| REQ-025 | Scan Diagram Generation — 6 diagram type .mmd files from codebase analysis | scan-diagrams    | pending         | planned |
| REQ-026 | Scan Diagram Rendering — .mmd → SVG via Mermaid CLI / D2 / Kroki           | scan-diagrams    | pending         | planned |
| REQ-027 | Scan HTML Report — self-contained report with inline SVGs + all sections    | scan-report      | pending         | planned |
| REQ-028 | Scan Document Export — DOCX (Pandoc) + PDF (md-to-pdf) export flags        | scan-export      | pending         | planned |
| REQ-029 | Diagram Rendering Toolchain — Mermaid CLI → D2 → Kroki fallback chain      | scan-diagrams    | pending         | planned |
| REQ-030 | MCP Diagram Server Support — diagram-bridge-mcp / C4Diagrammer / mcp-mermaid | scan-diagrams  | pending         | planned |

## Requirements Traceability (updated by plan phase — M25)

| REQ-ID  | Requirement Summary                                         | Domain              | Task(s)                        | Status  |
|---------|-------------------------------------------------------------|---------------------|--------------------------------|---------|
| REQ-031 | Per-Task Telemetry Collection — collector + emission        | metrics-collection  | Task 1, 2, 3, 4, 5            | planned |
| REQ-032 | Milestone Rollup & Process ELO — rollup + heuristics       | metrics-rollup      | Task 1, 2, 3, 4, 5            | planned |
| REQ-033 | Metrics Dashboard Panel — /metrics endpoint + Chart.js     | metrics-dashboard   | Task 1, 2                      | planned |
| REQ-034 | gsd-t-metrics Command — 50th command                       | metrics-commands    | Task 1, 3, 4                   | planned |
| REQ-035 | Process ELO in Status — ELO display in status output       | metrics-commands    | Task 2                         | planned |

**Orphaned requirements**: REQ-001 through REQ-017 (all M1-M13 deliverables, complete — not mapped to M14+ tasks by design).
**Unanchored tasks**: metrics-commands Task 3 (CLI count) and Task 4 (4 reference files) are infrastructure supporting REQ-034 — implicitly mapped.

## Requirements Traceability (updated by plan phase — M26)

| REQ-ID  | Requirement Summary                                         | Domain              | Task(s)                        | Status  |
|---------|-------------------------------------------------------------|---------------------|--------------------------------|---------|
| REQ-036 | Declarative Rule Engine — rule evaluator + activation tracking | rule-engine       | Task 1, 2, 3                   | pending |
| REQ-037 | Patch Template System — templates.jsonl + seed data          | rule-engine         | Task 2, 4                      | pending |
| REQ-038 | Patch Lifecycle Manager — 5-stage lifecycle + promotion gate | patch-lifecycle     | Task 1, 2, 3                   | pending |
| REQ-039 | Active Rule Injection in Execute                             | command-integration | Task 1                         | pending |
| REQ-040 | Rule-Based Pre-Mortem in Plan                                | command-integration | Task 2                         | pending |
| REQ-041 | Distillation Extension — rules + patches + graduation        | command-integration | Task 3                         | pending |
| REQ-042 | Quality Budget Governance — rework ceiling + tightening      | command-integration | Task 3                         | pending |

**Orphaned requirements**: None — all M26 REQs mapped to tasks.
**Unanchored tasks**: rule-engine Task 5 (tests) and patch-lifecycle Task 4 (tests) are QA infrastructure supporting all REQs. command-integration Task 4 (reference docs) supports Pre-Commit Gate compliance.

## Requirements Traceability (updated by plan phase — M27)

| REQ-ID  | Requirement Summary                                         | Domain              | Task(s)                        | Status  |
|---------|-------------------------------------------------------------|---------------------|--------------------------------|---------|
| REQ-043 | Global Sync Manager — read local, write global, compare     | global-metrics      | Task 1, 2, 3, 4               | pending |
| REQ-044 | Cross-Project Rule Propagation — update-all syncs rules     | cross-project-sync  | Task 1, 3                      | pending |
| REQ-045 | Universal Rule Promotion — 3+ universal, 5+ npm candidate   | global-metrics, cross-project-sync | gm Task 3, cps Task 2 | pending |
| REQ-046 | Cross-Project Signal Comparison — metrics --cross-project    | command-extensions  | Task 1                         | pending |
| REQ-047 | Global ELO & Rankings — status global ELO display            | command-extensions  | Task 2                         | pending |
| REQ-048 | Global Rule Promotion on Milestone Completion                | command-extensions  | Task 3                         | pending |

**Orphaned requirements**: None — all M27 REQs mapped to tasks.
**Unanchored tasks**: global-metrics Task 4 (tests) and cross-project-sync Task 3 (tests) are QA infrastructure supporting REQ-043 through REQ-045. command-extensions Task 4 (reference docs) supports Pre-Commit Gate compliance.

## Requirements Traceability (updated by plan phase — M29)

| REQ-ID  | Requirement Summary                                          | Domain               | Task(s)        | Status  |
|---------|--------------------------------------------------------------|----------------------|----------------|---------|
| REQ-053 | Debug Ledger Protocol — JSONL ledger with read/write/compact | debug-state-protocol | Task 1, 2, 3   | complete |
| REQ-054 | Headless Debug-Loop — external loop controller               | headless-loop        | Task 1, 2, 3   | complete |
| REQ-055 | Anti-Repetition Preamble — failed hypothesis injection       | debug-state-protocol, headless-loop | dsp Task 2, hl Task 2 | complete |
| REQ-056 | Debug-Loop Command Integration — delegate after 2 failures   | command-integration  | Task 1, 2      | complete |

**Orphaned requirements**: None — all M29 REQs mapped to tasks.
**Unanchored tasks**: debug-state-protocol Task 3 (tests) and headless-loop Task 3 (tests) are QA infrastructure supporting REQ-053 through REQ-055. command-integration Task 3 (reference docs) supports Pre-Commit Gate compliance.

## Requirements Traceability (updated by plan phase — M30)

| REQ-ID  | Requirement Summary                                          | Domain               | Task(s)        | Status  |
|---------|--------------------------------------------------------------|----------------------|----------------|---------|
| REQ-057 | Stack Rule Templates — react.md, typescript.md, node-api.md  | stack-templates      | Task 1, 2, 3   | complete |
| REQ-058 | Stack Detection Engine — auto-detect + prompt injection      | command-integration  | Task 1, 2      | complete |
| REQ-059 | Stack Rule QA Enforcement — QA validates compliance          | command-integration  | Task 1, 2      | complete |

**Orphaned requirements**: None — all M30 REQs mapped to tasks.
**Unanchored tasks**: command-integration Task 3 (tests) is QA infrastructure supporting REQ-057 through REQ-059. command-integration Task 4 (reference docs) supports Pre-Commit Gate compliance.

## Requirements Traceability (updated by plan phase — M32)

| REQ-ID  | Requirement Summary                                          | Domain                  | Task(s) | Status  |
|---------|--------------------------------------------------------------|-------------------------|---------|---------|
| REQ-060 | Quality North Star Persona — CLAUDE-project template + init/setup detection and config | quality-persona | Task 1  | complete |
| REQ-061 | Design Brief Generation — partition detection + plan note + setup option               | design-brief    | Task 1  | complete |
| REQ-062 | Exploratory Testing Blocks — post-scripted Playwright MCP exploration in 4 commands    | evaluator-interactivity | Task 1 | complete |

**Orphaned requirements**: None — all M32 REQs mapped to tasks.
**Unanchored tasks**: None — all 3 domain tasks map directly to functional requirements.

## Requirements Traceability (updated by plan phase — M34)

| REQ-ID  | Requirement Summary                                                                     | Domain                      | Task(s)  | Status   |
|---------|------------------------------------------------------------------------------------------|-----------------------------|----------|----------|
| REQ-063 | Context Meter PostToolUse hook — count_tokens API call, state file, fail-open            | context-meter-hook          | Tasks 1–5 | complete |
| REQ-064 | Context Meter config schema — apiKeyEnvVar, modelWindowSize, thresholdPct, checkFrequency | context-meter-config        | Tasks 1–4 | complete |
| REQ-065 | Installer integration — install/init hook, doctor gate, status line, update-all migration | installer-integration       | Tasks 1–6 | complete |
| REQ-066 | bin/token-budget.js v2.0.0 — real-source `getSessionStatus()` reading the meter state file | token-budget-replacement    | Tasks 1–10 | complete |
| REQ-067 | Command file migration — execute/wave/quick/integrate/debug use CTX_PCT, no task-counter  | token-budget-replacement    | Tasks 6–10 | complete |
| REQ-068 | Docs + tests — README/GSD-T-README/templates/docs/CHANGELOG updated, integration tests added | m34-docs-and-tests          | Tasks 1–9 | in_progress |

**M34 Functional Requirements:**
- **REQ-063**: The PostToolUse hook must measure the real transcript token count after every tool call (subject to `checkFrequency`), write the result atomically to `.gsd-t/.context-meter-state.json`, and never crash Claude Code on error.
- **REQ-064**: The config loader must validate `apiKeyEnvVar` is a string, `modelWindowSize` > 0, `thresholdPct` in (0, 100), `checkFrequency` ≥ 1. Missing config = use defaults.
- **REQ-065**: `gsd-t doctor` must hard-gate on: API key set, hook registered, script present, config valid, live `count_tokens` dry-run succeeds. Exit code 1 if any RED.
- **REQ-066**: `bin/token-budget.js` `getSessionStatus()` must read `.gsd-t/.context-meter-state.json` when fresh (within 5 minutes of timestamp) and fall back to a historical heuristic otherwise. Public API shape unchanged from v1.x — callers see no breakage.
- **REQ-067**: No command file may reference `task-counter.cjs` or `CLAUDE_CONTEXT_TOKENS_*` env vars. All session-stop gates must call `token-budget.getSessionStatus()`.
- **REQ-068**: All downstream docs (README.md, docs/GSD-T-README.md, templates/CLAUDE-*, docs/*.md, CHANGELOG.md, package.json) must describe M34 by the time the milestone is marked complete.

**M34 Non-Functional Requirements:**
- Hook latency ≤ 200ms P99 (enforced by `req.setTimeout` + `req.destroy()` in the HTTPS client)
- Zero external npm dependencies (same as the rest of GSD-T)
- Zero message content in state files, log files, or diagnostics — only token counts, band names, error category codes
- Zero API-key material written to disk — env var read only, never persisted

**Orphaned requirements**: None — all M34 REQs mapped to tasks.
**Unanchored tasks**: None — all 34 M34 tasks map directly to functional or non-functional requirements.

---

## Requirements Traceability (updated by plan phase — M35)

| REQ-ID  | Requirement Summary                                                                     | Domain                      | Task(s)   | Status   |
|---------|-----------------------------------------------------------------------------------------|-----------------------------|-----------|----------|
| REQ-069 | Silent degradation bands removed — `getDegradationActions()` returns only `{band: 'normal'\|'warn'\|'stop'}` | degradation-rip-out | T1 | complete (Wave 1) |
| REQ-070 | Three-band model only — `WARN_THRESHOLD_PCT=70`, `STOP_THRESHOLD_PCT=85`, no model overrides or phase skips | degradation-rip-out | T1, T2 | complete (Waves 1–2) |
| REQ-071 | Surgical per-phase model selection via `bin/model-selector.js` — ≥8 phase mappings, declarative rules table | model-selector-advisor | T2 | complete (Wave 2) |
| REQ-072 | `/advisor` escalation with graceful fallback — convention-based if API not programmable | model-selector-advisor | T1, T3 | complete (Wave 2) |
| REQ-073 | Pre-flight runway estimator refuses runs projected to cross 85% stop threshold | runway-estimator | T1–T5 | SUPERSEDED by REQ-088 (M38) — runway-estimator deleted; headless-by-default replaces the refusal gate |
| REQ-074 | Per-spawn token telemetry to `.gsd-t/token-metrics.jsonl` with frozen 18-field schema | token-telemetry | T1–T3 | SUPERSEDED by REQ-092 (M38) — token-telemetry deleted; single-band meter obviates the feed |
| REQ-075 | `gsd-t metrics` CLI: `--tokens [--by ...]`, `--halts`, `--tokens --context-window` | token-telemetry | T4–T6 | SUPERSEDED by REQ-092 (M38) — `--tokens`/`--halts` emitters removed with telemetry deletion |
| REQ-076 | Optimization backlog — detect only, never auto-apply, user promotes or rejects | optimization-backlog | T1–T4 | SUPERSEDED by REQ-093 (M38) — self-improvement loop deleted; signal never produced action |
| REQ-077 | Headless auto-spawn on runway refusal — user never sees a `/clear` prompt | headless-auto-spawn | T1–T5 | SUPERSEDED by REQ-088 (M38) — headless-by-default promotes auto-spawn from emergency pivot to default primitive |
| REQ-078 | Structural elimination of native compact messages — `halt_type: native-compact` count is 0 during M35 execution | runway-estimator + headless-auto-spawn | T1–T5 (RE), T1–T5 (HAS) | SUPERSEDED by REQ-088 (M38) — achieved via structural headless-default spawn, not runway projection |
| REQ-079 | `gsd-t unattended` CLI subcommand runs an active milestone to completion unattended on macOS and Linux (24h+ multi-worker relay, detached OS process) | m36-supervisor-core | T1–T5 | complete (M36 Wave 1–2) |
| REQ-080 | `/gsd-t-unattended` slash command launches the supervisor from within a Claude session without blocking the terminal | m36-supervisor-core + m36-watch-loop | T1, T3 | complete (M36 Wave 1–3) |
| REQ-081 | In-session watch loop ticks every 270s via `ScheduleWakeup` (inside 5-min prompt-cache TTL) to report live supervisor state | m36-watch-loop | T1–T2 | complete (M36 Wave 3) |
| REQ-082 | `/clear` + `/gsd-t-resume` during a live unattended run transparently re-attaches to the watch loop (Step 0 auto-reattach, no user-visible disruption) | m36-watch-loop | T4 | complete (M36 Wave 3) |
| REQ-083 | Supervisor survives `/compact` and context resets — each worker is a fresh `claude -p` session; context exhaustion is structurally irrelevant | m36-supervisor-core | T1–T5 | complete (M36 Wave 1–2) |
| REQ-084 | Safety rails prevent infinite loops: gutter detection, blocker sentinels (`BLOCKED_NEEDS_HUMAN`, `DISPATCH_FAILED`), max-hours and max-iterations timeouts | m36-safety-rails | T1–T5 | complete (M36 Wave 2) |
| REQ-085 | Cross-platform support — macOS (caffeinate sleep-prevention) + Linux (systemd-inhibit or no-op) + Windows (claude.cmd via PATH; sleep-prevention not supported — see docs/unattended-windows-caveats.md) | m36-cross-platform | T1–T5 | complete (M36 Wave 2) |
| REQ-086 | Handoff-lock primitive (`bin/handoff-lock.js`) eliminates parent/child race in `headless-auto-spawn.js` runway handoffs (M35 gap fix) | m36-m35-gap-fixes | T1–T3 | complete (M36 Wave 2) |
| REQ-087 | 5 command files no longer emit "Run /clear" STOP — runway-exceeded handoff auto-invokes `autoSpawnHeadless()` seamlessly (M35 gap fix) | m36-m35-gap-fixes | T3 | complete (M36 Wave 3) |

**M35 Functional Requirements:**
- **REQ-069**: `bin/token-budget.js` `getDegradationActions()` must return `{band: 'normal'|'warn'|'stop', pct: number, message: string}` only. No `modelOverride`, no `skipPhases`, no `checkpoint` side-channel.
- **REQ-070**: `WARN_THRESHOLD_PCT = 70`, `STOP_THRESHOLD_PCT = 85`. `grep -r "downgrade\|conserve\|modelOverride\|skipPhases" bin/ commands/ docs/ templates/` returns zero hits in live code.
- **REQ-071**: `bin/model-selector.js` exists with a declarative rules table, at least 8 phase mappings across all three tiers (haiku/sonnet/opus), and unit tests for each mapping.
- **REQ-072**: `bin/advisor-integration.js` exists. If `/advisor` is programmable: calls it. If not: convention-based fallback block injection. Graceful degradation: missed escalations logged, caller never blocked.
- **REQ-073**: _SUPERSEDED by REQ-088 (M38, v3.12.10)._ Original: runway estimator refusal at Step 0 of long-running commands. M38 deletes `bin/runway-estimator.cjs`; headless-by-default primitive handles context pressure structurally (no projection needed).
- **REQ-074**: _SUPERSEDED by REQ-092 (M38, v3.12.10)._ Original: 18-field per-spawn token telemetry to `.gsd-t/token-metrics.jsonl`. M38 deletes `bin/token-telemetry.cjs`; the single-band meter keeps only local-estimator readings — no bracketed per-spawn records.
- **REQ-075**: _SUPERSEDED by REQ-092 (M38, v3.12.10)._ Original: `gsd-t metrics --tokens|--halts|--context-window` CLI emitters. M38 retires those subcommands with telemetry deletion.
- **REQ-076**: _SUPERSEDED by REQ-093 (M38, v3.12.10)._ Original: `bin/token-optimizer.js` detect-only recommendations with user promote/reject. M38 deletes the self-improvement loop (4 commands + `qa-calibrator.js` + `token-optimizer.js`) — signal never produced action.
- **REQ-077**: _SUPERSEDED by REQ-088 (M38, v3.12.10)._ Original: `autoSpawnHeadless()` invoked only on runway refusal. M38 promotes it to the default spawn primitive for workflow commands; see `headless-default-contract.md` v1.0.0.
- **REQ-078**: _SUPERSEDED by REQ-088 (M38, v3.12.10)._ Original: runway-projection + STOP_THRESHOLD combo makes native-compact structurally unreachable. M38 achieves the same guarantee via headless-default spawning — context resets by design, not by projection.

**M35 Non-Functional Requirements:**
- Zero external npm dependencies (GSD-T mandate — token-telemetry.js, runway-estimator.js, headless-auto-spawn.js must use Node.js built-ins only)
- `autoSpawnHeadless()` must return control to the interactive session in < 500ms (detached spawn is immediate)
- `estimateRunway()` must complete in < 100ms (reads two local files, no network)
- Full test suite: target ~1030 tests total after M35; quality over count

**Orphaned requirements**: None — all M35 REQs mapped to tasks.
**Unanchored tasks**: None — all 38 M35 tasks trace to REQ-069–REQ-078 or REQ-063–068 (existing requirements that M35 code continues to satisfy).

**M36 Functional Requirements:**
- **REQ-079**: `bin/gsd-t-unattended.js` implements the supervisor relay loop: spawn worker → await exit → post-worker safety check → next iter. State written atomically to `.gsd-t/.unattended/state.json`. Contract: `unattended-supervisor-contract.md` v1.0.0.
- **REQ-080**: `commands/gsd-t-unattended.md` pre-flights branch + dirty tree, spawns supervisor detached, polls for PID readiness, displays initial watch block, and calls `ScheduleWakeup(270, '/gsd-t-unattended-watch')`.
- **REQ-081**: `commands/gsd-t-unattended-watch.md` implements the watch tick decision tree (§8 of contract): reads PID → liveness probe → reads state.json → reschedule or terminal report.
- **REQ-082**: `commands/gsd-t-resume.md` Step 0 checks `supervisor.pid` before any other resume logic. If live + non-terminal: skip normal resume, print watch block, call `ScheduleWakeup(270, '/gsd-t-unattended-watch')`.
- **REQ-083**: Supervisor relay architecture ensures each worker gets a fresh context window. No compaction state carries over between workers — only `.gsd-t/` milestone state files.
- **REQ-084**: `bin/gsd-t-unattended-safety.js` exports: `checkGitBranch`, `checkWorktreeCleanliness`, `validateState`, `checkIterationCap`, `checkWallClockCap`, `detectBlockerSentinel`, `detectGutter`. Called at all 4 supervisor hook points.
- **REQ-085**: `bin/gsd-t-unattended-platform.js` exports: `spawnSupervisor`, `preventSleep`, `releaseSleep`, `notify`, `resolveClaudePath`. Windows: `preventSleep` is a documented no-op. Windows caveats documented in `docs/unattended-windows-caveats.md`.
- **REQ-086**: `bin/handoff-lock.js` exports: `acquireLock(dir)`, `releaseLock(dir)`, `isLocked(dir)`. Used in `bin/headless-auto-spawn.js` `autoSpawnHeadless()` to guard the parent-exits-before-child-starts window.
- **REQ-087**: `commands/gsd-t-execute.md`, `gsd-t-wave.md`, `gsd-t-integrate.md`, `gsd-t-quick.md`, `gsd-t-debug.md` — runway-exceeded path calls `autoSpawnHeadless()` and exits cleanly. No "Run /clear" instruction emitted.

**M36 Non-Functional Requirements:**
- Zero external npm dependencies (all M36 bin/ modules use Node.js built-ins only)
- Supervisor launch → PID-ready in < 5 seconds (poll timeout in launch command)
- Worker spawn overhead: < 500ms before `claude -p` subprocess starts
- Test count: 1146 → 1226 (+80 net new tests across 6 M36 domain test files)

**Orphaned requirements**: None — all M36 REQs mapped to tasks.
**Unanchored tasks**: None — all M36 tasks trace to REQ-079–REQ-087.

**M38 Functional Requirements:**
- **REQ-088**: Workflow commands (execute, wave, integrate, debug repair loops) spawn detached by default via the unattended supervisor. Interactive session returns after printing a launch banner and event-stream log location. Contract: `headless-default-contract.md` v1.0.0. Traces to: m38-headless-spawn-default T1–T6.
- **REQ-089**: `--watch` flag keeps a live status block in the interactive session (270s `ScheduleWakeup` ticks, cache-window-safe). Without `--watch`, the session exits; the user is notified via macOS when work completes. Flag propagates through wave → phase commands. Traces to: m38-headless-spawn-default T4.
- **REQ-090**: Supervisor emits JSONL events to `.gsd-t/events/YYYY-MM-DD.jsonl` at every phase boundary (`task_start`, `task_complete`, `error`, `retry`). Cursor state at `.gsd-t/.unattended/event-cursor`. Shared library: `bin/event-stream.cjs`. Contract: `unattended-event-stream-contract.md` v1.0.0, supervisor contract bumped to v1.1.0. Traces to: m38-unattended-event-stream T1–T5.
- **REQ-091**: Smart Router classifies non-continuation messages as conversational or workflow. Conversational triggers (thinking/brainstorming/exploring) get inline responses with no command spawn. Workflow triggers route to the existing semantic evaluation. Default on ambiguity: conversational. Traces to: m38-router-conversational T1–T5.
- **REQ-092**: Context Meter collapses to a single-band model (`context-meter-contract.md` v1.3.0). One threshold, one action — hand off to a detached spawn. Three-band routing (`normal`/`warn`/`stop`) and `MANDATORY STOP` rule removed. Traces to: m38-meter-reduction T1–T6.
- **REQ-093**: Self-improvement loop deleted — 4 commands (`gsd-t-optimization-apply`, `gsd-t-optimization-reject`, `gsd-t-reflect`, `gsd-t-audit`) and 2 bin files (`qa-calibrator.js`, `token-optimizer.js`) removed. Their signal never produced action; the work that would close the loop is folded into the spawn decision. Traces to: m38-cleanup-and-docs T1–T10.

**M38 Non-Functional Requirements:**
- Net LOC decrease ≥ 5,000 (success criterion #11 of the milestone)
- `npm test` green through every domain commit
- Zero external npm dependencies (inherited — applies to `bin/event-stream.cjs`, `bin/unattended-watch-format.cjs`)

**Orphaned requirements**: None — all M38 REQs mapped to tasks.
**Unanchored tasks**: None — all M38 tasks trace to REQ-088–REQ-093.

---

## M17: Scan Visual Output — Feature Specification

**Goal**: Transform `gsd-t-scan` from a text-only analysis tool into a rich visual report generator. Every scan produces a beautiful, self-contained HTML report with live diagrams, a tech debt register, and domain health scores — plus optional export to Google Docs via DOCX or PDF.

### Scope

| Area | Description |
|------|-------------|
| Schema extraction | Detect and parse ORM/schema files to extract entity relationships |
| Diagram generation | Generate Mermaid (.mmd) diagram definitions for 6 diagram types |
| Diagram rendering | Render .mmd → SVG using Mermaid CLI, D2, or Kroki (auto-fallback) |
| HTML report | Self-contained dark-theme report with inline SVGs and expand-to-fullscreen |
| Document export | DOCX (Pandoc → Google Docs) and PDF (md-to-pdf) export via --export flag |
| MCP support | Optional MCP server integration when registered in Claude Code settings |

### Diagram Types (REQ-025)

| # | Diagram | Source Analysis | Mermaid Syntax |
|---|---------|-----------------|----------------|
| 1 | System Architecture | Config files, imports, env vars, API clients | `C4Context` or `graph TB` |
| 2 | Application Architecture | Module/class structure, framework layers, routing | `graph TB` with subgraphs |
| 3 | Workflow | Status enums, state transition methods, FSM patterns | `stateDiagram-v2` |
| 4 | Data Flow | Request handlers, validation pipes, DB calls, queue producers | `flowchart TD` |
| 5 | Sequence | Critical API endpoint: auth flow or primary resource creation | `sequenceDiagram` |
| 6 | Database Schema | ORM entities / Prisma schema / SQL migrations (REQ-024) | `erDiagram` |

### ORM Detection Matrix (REQ-024)

| ORM / Tool | Detection Signal | Schema Source |
|------------|-----------------|---------------|
| TypeORM | `@Entity()`, `typeorm` import | `*.entity.ts` files |
| Prisma | `prisma/schema.prisma` exists | `schema.prisma` |
| Drizzle | `drizzle-orm` import | `schema.ts` / `*.schema.ts` |
| Mongoose | `mongoose.Schema`, `new Schema` | `*.model.ts` / `*.schema.ts` |
| Sequelize | `DataTypes`, `Model.init` | `*.model.js/ts` |
| SQLAlchemy | `declarative_base`, `Column` | `models.py` / `*.model.py` |
| Raw SQL | `CREATE TABLE` in `.sql` files | `migrations/*.sql` |

### Rendering Toolchain (REQ-029)

```
RENDER REQUEST
  ├── Is `mmdc` (Mermaid CLI) available?
  │     YES → mmdc -i diagram.mmd -o diagram.svg -t dark   (primary)
  │     NO  ↓
  ├── Is `d2` available AND diagram type is arch/dataflow?
  │     YES → d2 diagram.d2 diagram.svg --layout=dagre      (enhanced)
  │     NO  ↓
  ├── Is network available?
  │     YES → POST diagram src to kroki.io → SVG response   (fallback)
  │     NO  ↓
  └── Embed "diagram unavailable" placeholder in report     (graceful degrade)
```

### HTML Report Structure (REQ-027)

```
scan-report.html
  ├── Sidebar navigation (scrollspy, domain/diagram/analysis sections)
  ├── Compact page header (project name, version, date, stack)
  ├── Summary (metric cards: files, LoC, debt counts, coverage, deps, endpoints)
  ├── Domains (health cards with file inventory and health % bar)
  ├── Diagram sections × 6 (title bar + type badge + SVG + expand button + note)
  ├── Tech Debt Register (table: severity badge, domain, issue, location, effort)
  └── Key Findings (actionable cards: security, architecture, reliability, quality)
```

### Document Export (REQ-028)

| Flag | Tool | Output | Google Docs Path |
|------|------|--------|-----------------|
| `--export=docx` | Pandoc (GPL) | `scan-report.docx` | Upload to Drive → Open with Google Docs |
| `--export=pdf` | md-to-pdf (MIT) | `scan-report.pdf` | Upload to Drive → open directly |
| _(none)_ | — | `scan-report.html` | Copy/paste markdown, or File → Import |

### Free & Open Source Toolchain Confirmation

| Tool | License | Free? | Paid Components |
|------|---------|-------|-----------------|
| Mermaid CLI (`@mermaid-js/mermaid-cli`) | MIT  | Yes | None |
| D2 (terrastruct/d2) | MPL-2.0  | Yes | TALA layout only (excluded) |
| Kroki (yuzutech/kroki) | MIT  | Yes | None (self-host or free kroki.io) |
| diagram-bridge-mcp (tohachan) | MIT  | Yes | None |
| C4Diagrammer (jonverrier) | MIT  | Yes | None |
| mcp-mermaid (hustcc) | MIT  | Yes | None |
| Pandoc | GPL v2+  | Yes | None |
| md-to-pdf (simonhaenisch) | MIT  | Yes | None |

### Mock Reference

A reference implementation of the HTML report output is at `scan-report-mock.html` (project root). It demonstrates all 6 diagram types, the tech debt register, domain health cards, and the expand-to-fullscreen interaction. Use this as the visual specification for the HTML report (REQ-027).

---

## Gaps Identified

### Open (Scan #6 — 2026-02-18, Post-M10-M13)
- 14 new items: TD-066 through TD-079 (1 high: untestable new scripts; 5 medium: contract drift + doc staleness + stateSet injection; 7 low: cleanup)
- See `.gsd-t/techdebt.md` for full list

### Resolved (Milestone 9 + Milestones 10-13, 2026-02-18)
- ~~Scan #5 items (TD-056-TD-065)~~ — RESOLVED (M9, Cleanup Sprint)
- ~~Token efficiency gaps~~ — RESOLVED (M10)
- ~~Execution quality gaps (no deviation rules, no per-task commits)~~ — RESOLVED (M11)
- ~~Planning intelligence gaps (no CONTEXT.md, no plan validation)~~ — RESOLVED (M12)
- ~~Tooling gaps (no state CLI, no statusline, no health command, no pause)~~ — RESOLVED (M13)

### Resolved (Milestones 3-8, 2026-02-18/19)
- ~~All scan #4 items (TD-044-TD-055)~~ — RESOLVED (M8)
- ~~No automated test suite (TD-003)~~ — RESOLVED (116 tests, M4)
- ~~Command count 42→43 not updated (TD-022)~~ — RESOLVED (M3)
- ~~QA agent contract missing test-sync (TD-042)~~ — RESOLVED (M3)
- ~~Wave bypassPermissions not documented (TD-035)~~ — RESOLVED (M5)
- ~~All 15 scan #3 functions >30 lines (TD-021)~~ — RESOLVED (M6, all 81 functions ≤30 lines)
- ~~34 fractional step numbers (TD-031)~~ — RESOLVED (M7, all renumbered)
- ~~Backlog file format drift (TD-014)~~ — RESOLVED
- ~~Progress.md format drift (TD-015)~~ — RESOLVED
- ~~7 backlog commands missing from GSD-T-README (TD-016)~~ — RESOLVED

## M40 Requirements Traceability (plan phase — 2026-04-19)

Milestone 40 (External Task Orchestrator + Streaming Watcher UI) decomposes into 5 measurable requirements drawn directly from `progress.md` Current Milestone § Success criteria. Task numbers reference `.gsd-t/domains/*/tasks.md`.

| REQ-ID | Requirement Summary | Domain | Task(s) | Status |
|--------|---------------------|--------|---------|--------|
| REQ-M40-01 | Speed parity or better vs in-session (D0 kill-switch gate) | d0-speed-benchmark | Tasks 1, 2, 3 | pending |
| REQ-M40-02 | No compaction — one task per spawn, fresh context each time | d1-orchestrator-core | Tasks 3, 4, 6 | pending |
| REQ-M40-03 | Live streaming UI on localhost:7842 at zero Claude token cost | d4-stream-feed-server, d5-stream-feed-ui | D4 Tasks 1–5, D5 Tasks 1–5 | pending |
| REQ-M40-04 | Per-wave Promise.all parallelism with Team Mode §15 ceiling (15 max) | d1-orchestrator-core | Tasks 1, 4, 6 | pending |
| REQ-M40-05 | Recovery from durable JSONL + progress.md on orchestrator crash | d6-recovery-and-resume | Tasks 1, 2, 3, 4 | pending |

Supporting contracts (no direct REQ mapping — shared infrastructure):
- `task-brief-contract.md` (d2-task-brief-builder Tasks 1–3) — enables REQ-M40-02 via self-contained briefs
- `completion-signal-contract.md` (d3-completion-protocol Tasks 1–3) — enables REQ-M40-02 and REQ-M40-05 via deterministic done-signal
- `wave-join-contract.md` (d1-orchestrator-core) — enables REQ-M40-04
- `stream-json-sink-contract.md` (d1↔d4 joint) — enables REQ-M40-03

All 5 REQs map to at least one task; no orphaned requirements. All 25 tasks across 7 domains trace to at least one REQ (task-brief/completion tasks support via contract infra).

## M43 Universal Token Attribution (partition phase — 2026-04-21)

Milestone 43 (Token Attribution & Always-Headless Inversion — target v3.17.10) decomposes into 6 measurable requirements across two themes. Task numbers reference `.gsd-t/domains/m43-*/tasks.md`.

| REQ-ID | Requirement Summary | Domain | Status |
|--------|---------------------|--------|--------|
| REQ-M43-01 | Per-turn in-session token usage captured on every dialog turn; rows land in `.gsd-t/metrics/token-usage.jsonl` with `turn_id`, `session_id`, `sessionType: "in-session"` | D1 in-session-usage-capture | **Wave 1 complete (2026-04-21)** — Branch B locked (transcript-sourced, Stop-hook-triggered). Live end-to-end validated: 523 rows in sink from real transcript. |
| REQ-M43-02 | Per-tool attribution via output-byte ratio — `gsd-t tool-cost --group-by tool\|command\|domain` shows non-zero attribution across Bash/Read/Edit/Grep/Task | D2 per-tool-attribution | pending (Wave 2) |
| REQ-M43-03 | One canonical sink + schema v2 for all token rows; `.gsd-t/token-log.md` regeneratable view | D3 sink-unification-backfill | **complete (2026-04-21)** minus D3-T4.1 backfill parser follow-up |
| REQ-M43-04 | Every command spawns; zero `--in-session` / `--headless` flag matches in `commands/*.md` after D4 | D4 default-headless-inversion | pending (Wave 3) |
| REQ-M43-05 | Router dialog-growth meter warns when `/compact` predicted within N turns; pure read/warn, never refuses | D5 dialog-channel-meter | pending (Wave 2) |
| REQ-M43-06 | Dashboard URL printed at every spawn; transcript viewer auto-launches on first spawn if not running; tool-cost panel renders against any spawn | D6 transcript-viewer-primary-surface | pending (Wave 2) |

### D1 Branch Lock (2026-04-21)

Branch B chosen. Evidence from `.gsd-t/.hook-probe/` payloads (captured during supervisor-2026-04-21-2320 session):

- Stop / SessionEnd / PostToolUse hook payloads carry `session_id`, `transcript_path`, `cwd`, `hook_event_name` — **but no `usage`**.
- `transcript_path` JSONL rows contain `message.usage` with `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, `total_cost_usd` — same shape the M40 D4 aggregator already parses.

**Hybrid chosen**: Stop hook = trigger, transcript = data source. `bin/gsd-t-in-session-usage.cjs::processHookPayload` reads the transcript since the last cursor, emits one v2-schema JSONL row per assistant turn with `sessionType: "in-session"`, `turn_id` (Claude `message.id`), `session_id` (hook `session_id`). Idempotent across replays via per-session transcript-line cursor.

**Install path**: hook entry goes in user's `~/.claude/settings.json` (or project `.claude/settings.json`) — not written by the installer. The user wires it once:

```json
{ "matcher": "", "hooks": [
    { "type": "command",
      "command": "node \"$HOME/.claude/scripts/gsd-t-in-session-usage-hook.js\"",
      "async": true } ] }
```

Supporting contracts:
- `metrics-schema-contract.md` v2 — owns `turn_id`, `session_id`, `sessionType`, `tool_attribution[]`
- `stream-json-sink-contract.md` v1.2.0 — formalizes dialog-channel entry-point (D1)
- `tool-attribution-contract.md` v1.0.0 — output-byte ratio algorithm (D2, new contract)
- `headless-default-contract.md` v2.0.0 — always-headless rule (D4, bump pending)

## M44 Task-Graph Reader (D1 — execute phase 2026-04-22)

Milestone 44 D1 ships the shared DAG that all downstream M44 domains (D2 parallel CLI, D3 command-file integration, D4 dep-graph validation, D5 file-disjointness prover, D6 pre-spawn economics) consume. Mode-agnostic: produces only a graph, owns no in-session vs unattended branching.

| REQ-ID | Requirement Summary | Domain | Status |
|--------|---------------------|--------|--------|
| REQ-M44-D1-01 | `bin/gsd-t-task-graph.cjs` parses every `.gsd-t/domains/*/tasks.md` into a typed in-memory DAG: nodes `{id, domain, wave, title, status, deps, touches}`, edges `{from, to}`, `ready` mask, `byId` index, `warnings[]` | m44-d1-task-graph-reader | **complete (2026-04-22)** — 22/22 unit tests pass |
| REQ-M44-D1-02 | Cycle detection mandatory: throws `TaskGraphCycleError` with `.cycle: string[]` path on any circular dep — 3-task ring AND self-loop covered | m44-d1-task-graph-reader | **complete (2026-04-22)** — iterative three-color DFS; tests 3 + 4 |
| REQ-M44-D1-03 | Touch-list resolution: prefer task `**Touches**` / `**Files touched**`, fall back to domain `scope.md` `## Files Owned`, fall back to `[]` + warning | m44-d1-task-graph-reader | **complete (2026-04-22)** — both fallback paths tested |
| REQ-M44-D1-04 | Status markers: `[ ]` pending / `[x]` done / `[-]` skipped / `[!]` failed; unknown markers → pending + warning. Only `done` deps satisfy dependents (skipped/failed do NOT) | m44-d1-task-graph-reader | **complete (2026-04-22)** — covered by ready-mask tests |
| REQ-M44-D1-05 | Read-only invariant: never writes to `tasks.md`, `scope.md`, or any contract file during build/query | m44-d1-task-graph-reader | **complete (2026-04-22)** — sync `readFileSync` only, no `writeFileSync` calls |
| REQ-M44-D1-06 | Performance: parse + cycle-check + ready-mask in < 200 ms for 100-domain / 1000-task project | m44-d1-task-graph-reader | **complete (2026-04-22)** — measured 6 ms on 50-domain/250-task synthetic; 3 ms on this repo |
| REQ-M44-D1-07 | CLI debugging surface: `gsd-t graph --output json` (pretty JSON) and `--output table` (id/domain/wave/status/ready/deps), backward-compat with existing `graph index/status/query` | m44-d1-task-graph-reader | **complete (2026-04-22)** — verified live: 33 tasks · 36 edges · 2 ready |

Supporting contract:
- `task-graph-contract.md` v1.0.0 — locks DAG schema; downstream M44 domains may begin implementation against this contract.

## M44 Dep-Graph Validation (D4 — Wave 2 gate, 2026-04-22)

Milestone 44 D4 ships the pre-spawn dependency gate. Given the DAG from D1 (`buildTaskGraph`), it filters the candidate-ready set to tasks whose declared `deps[]` are **all** in DONE status, and emits a `dep_gate_veto` event for every task it removes. The consumer (D2) decides whether to spawn a smaller batch or fall back to sequential — D4 itself is a pure filter. Mode-agnostic: same call shape in-session and unattended.

| REQ-ID | Requirement Summary | Domain | Status |
|--------|---------------------|--------|--------|
| REQ-M44-D4-01 | `bin/gsd-t-depgraph-validate.cjs` exports `validateDepGraph({graph, projectDir}) → {ready: TaskNode[], vetoed: {task, unmet_deps[]}[]}`. Synchronous. Never throws on unmet deps. | m44-d4-depgraph-validation | **complete (2026-04-22)** — 13/13 unit tests pass |
| REQ-M44-D4-02 | Veto rule: a dep is satisfied iff `graph.byId[depId]` exists AND `status === 'done'`. Pending / skipped / failed / unknown all veto. (Matches `task-graph-contract.md` §5.) | m44-d4-depgraph-validation | **complete (2026-04-22)** — covered by skipped-dep, failed-dep, and unknown-dep tests |
| REQ-M44-D4-03 | For every vetoed task, append one `dep_gate_veto` event to `.gsd-t/events/YYYY-MM-DD.jsonl` carrying the full base event schema (ts ISO 8601, event_type, command/phase/agent_id/parent_agent_id/trace_id/model null, reasoning="unmet deps: …", outcome="deferred") PLUS D4-additive fields `task_id`, `domain`, `unmet_deps[]` | m44-d4-depgraph-validation | **complete (2026-04-22)** — event-schema assertion test covers all fields |
| REQ-M44-D4-04 | Non-throwing guarantee: unmet deps, unknown dep ids, and event-log I/O failures NEVER throw. Only malformed `opts` (missing `graph`) throws — programming error only. | m44-d4-depgraph-validation | **complete (2026-04-22)** — 20-task stress test + 3 throw-guard tests |
| REQ-M44-D4-05 | Read-only on all domain artifacts. Only write surface is appending JSONL lines to `.gsd-t/events/YYYY-MM-DD.jsonl` (events directory created on demand). Zero external runtime deps. | m44-d4-depgraph-validation | **complete (2026-04-22)** — only `appendFileSync`/`mkdirSync` on events dir |
| REQ-M44-D4-06 | Performance: adds < 50 ms to the pre-spawn path on a realistic 100-domain / 1000-task graph. O(R · D) where R = |candidate set|, D = avg deps/task. | m44-d4-depgraph-validation | **complete (2026-04-22)** — test suite runs in < 50 ms total |
| REQ-M44-D4-07 | Synthetic gate fixture: a task with one unmet dep (unknown id) is vetoed; an independent task in the same ready set passes through. | m44-d4-depgraph-validation | **complete (2026-04-22)** — `M44-D4 gate fixture` test |

Supporting contract:
- `depgraph-validation-contract.md` v1.0.0 — locks veto semantics, dep_gate_veto event payload, non-throw guarantee, read-only invariant, and the D4 → D5 → D6 pre-spawn pipeline ordering. Downstream D2/D3 may wire in.

## M44 File-Disjointness Prover (D5 — Wave 2 gate, 2026-04-22)

Milestone 44 D5 ships the pre-spawn gate that proves every candidate parallel-spawn set writes disjoint files. If two tasks would both write the same file, D5 removes them from the parallel set and routes them to a sequential queue. Unprovable tasks (no touch-list source) are always routed sequential as singletons — safe-default, never assume disjoint. Mode-agnostic: same function used by in-session (D2) and unattended (D6) consumers.

| REQ-ID | Requirement Summary | Domain | Status |
|--------|---------------------|--------|--------|
| REQ-M44-D5-01 | `bin/gsd-t-file-disjointness.cjs` exports `proveDisjointness({tasks, projectDir})` → `{parallel: TaskNode[][], sequential: TaskNode[][], unprovable: TaskNode[]}`. Synchronous. Never throws. | m44-d5-file-disjointness-prover | **complete (2026-04-22)** — 11/11 unit tests pass |
| REQ-M44-D5-02 | Touch-list source priority: (1) explicit `touches` populated by D1, (2) git-history heuristic bounded to 100 commits via `git log --name-only -n 100 -- .gsd-t/domains/<domain>/` intersecting with commit subjects containing the task id, (3) unprovable → always sequential | m44-d5-file-disjointness-prover | **complete (2026-04-22)** — fallback chain covered by `_resolveTouches` tests |
| REQ-M44-D5-03 | Union-find grouping over the pairwise write-target overlap relation: component size 1 → parallel; component size ≥ 2 → sequential (transitive closure) | m44-d5-file-disjointness-prover | **complete (2026-04-22)** — 3-task transitive-closure test verified |
| REQ-M44-D5-04 | For every task routed sequential (including unprovable singletons), append `{type:'disjointness_fallback', task_id, reason, ts}` to `.gsd-t/events/YYYY-MM-DD.jsonl`. Reasons: `unprovable` or `write-target-overlap`. Best-effort (silent on FS failure). | m44-d5-file-disjointness-prover | **complete (2026-04-22)** — event shape asserted in 3 tests |
| REQ-M44-D5-05 | Read-only on all domain artifacts. Only write surface is the event stream. Git subprocess wrapped in try/catch. Zero external runtime deps. | m44-d5-file-disjointness-prover | **complete (2026-04-22)** |
| REQ-M44-D5-06 | Robust input handling: `opts.tasks` missing/null, task missing `touches` field, empty candidate set — all return a valid partition without throwing | m44-d5-file-disjointness-prover | **complete (2026-04-22)** — robustness tests cover all four paths |

Supporting contract:
- `file-disjointness-contract.md` v1.0.0 — locks prover interface, fallback chain, and event format. Downstream D2/D6 may wire in.

## M44 Per-CW Attribution (D7 — Wave 1 foundation, 2026-04-22)

Milestone 44 D7 ships the per-Context-Window attribution surface that downstream consumers (D6 estimator calibration, the per-CW rollup in `gsd-t metrics`, the optimization report) need to keep working post-M44. Without `cw_id` on token-usage rows, every iter looks like a single CW even when Claude Code compacted mid-run; the calibration loop also needs a post-spawn signal so D6 can self-correct from the delta between predicted and observed CW utilization.

| REQ-ID | Requirement Summary | Domain | Status |
|--------|---------------------|--------|--------|
| REQ-M44-D7-01 | `bin/gsd-t-token-capture.cjs` accepts an optional `cw_id` field on `recordSpawnRow` / `captureSpawn`. When supplied, written to the JSONL row; when absent, omitted (NOT null, NOT ""). Pass-through only — wrapper does not derive `cw_id`. | m44-d7-per-cw-attribution | **complete (2026-04-22)** — 15/15 existing m41-token-capture tests still pass unchanged |
| REQ-M44-D7-02 | `metrics-schema-contract.md` bumped v2 → v2.1.0 documenting `cw_id` field + derivation rules (unattended: `cw_id == spawn_id`; in-session: `session_id + ":" + compaction_index`) | m44-d7-per-cw-attribution | **complete (2026-04-22)** |
| REQ-M44-D7-03 | `compaction-events-contract.md` bumped v1.0.0 → v1.1.0 adding `compaction_post_spawn` calibration event type appended to the same sink (`compactions.jsonl`); pairs `estimatedCwPct` with `actualCwPct` | m44-d7-per-cw-attribution | **complete (2026-04-22)** |
| REQ-M44-D7-04 | `scripts/gsd-t-calibration-hook.js` SessionStart hook: on `source=compact`, correlates with active spawn from `.gsd-t/.unattended/state.json`, derives `actualCwPct` from `payload.input_tokens` ÷ CW ceiling, appends one calibration row. Silent no-op when no active spawn (supervisor not running). | m44-d7-per-cw-attribution | **complete (2026-04-22)** — 19/19 unit tests in `test/m44-cw-attribution.test.js` |
| REQ-M44-D7-05 | Calibration hook safe to register alongside `scripts/gsd-t-compact-detector.js` — both fire on SessionStart, both write to the same sink, neither reads/writes the other's rows. Hook always exits 0 (throwing breaks Claude Code session start). | m44-d7-per-cw-attribution | **complete (2026-04-22)** — coexistence test verifies v1.0.0 detector rows remain intact when calibration row appended |
| REQ-M44-D7-06 | Backward compatibility: every pre-D7 v2 row remains a valid v2.1.0 row. Pre-D7 callers (no `cw_id` supplied) produce byte-identical output. Historical `token-usage.jsonl` rows are NOT backfilled with `cw_id`. | m44-d7-per-cw-attribution | **complete (2026-04-22)** |

Supporting contracts:
- `metrics-schema-contract.md` v2.1.0 — adds optional `cw_id` field; documents producer ownership (M44 D7) and derivation rules
- `compaction-events-contract.md` v1.1.0 — adds `compaction_post_spawn` calibration event; documents the calibration hook's lifecycle and guardrails

Out of scope for D7:
- Backfilling historical `token-usage.jsonl` rows with `cw_id` (consumers fall back to per-iter median for pre-D7 rows)
- Modifying `scripts/gsd-t-compact-detector.js` (D7 adds a companion hook only)
- Any economics logic (D6) or parallel dispatch logic (D2)

## M44 Pre-Spawn Economics Estimator (D6 — Wave 2 gate, 2026-04-22)

Milestone 44 D6 ships the pre-spawn economics estimator — a per-task CW-footprint predictor that feeds the D2 parallel-CLI's gating math with a `{estimatedCwPct, parallelOk, split, workerCount, matchedRows, confidence}` decision. D6 is a **HINT**, never a veto: it produces a mode-specific recommendation; D2 owns the final gate. Mode-aware: `estimatedCwPct` is mode-agnostic, but `parallelOk` uses 85 % CW for in-session (orchestrator-CW headroom) and 60 % for unattended (per-worker CW); unattended-only `split=true` when `estimatedCwPct > 60`.

| REQ-ID | Requirement Summary | Domain | Status |
|--------|---------------------|--------|--------|
| REQ-M44-D6-01 | `bin/gsd-t-economics.cjs` exports `estimateTaskFootprint({taskNode, mode, projectDir})` → `{estimatedCwPct, parallelOk, split, workerCount, matchedRows, confidence}`. Synchronous. Never returns `undefined` (global-median fallback guarantees a number). | m44-d6-pre-spawn-economics | **complete (2026-04-22)** — 9/9 unit tests pass |
| REQ-M44-D6-02 | Three-tier corpus lookup: exact `command+step+domain` triplet (HIGH ≥5 rows, MEDIUM 1–4 rows), fuzzy (domain-only, then command-only) → LOW, global median → FALLBACK. Corpus loaded ONCE per `projectDir` (sync cached read), never re-read per call. | m44-d6-pre-spawn-economics | **complete (2026-04-22)** — all four tiers covered by tmpdir-fixture tests |
| REQ-M44-D6-03 | Mode-specific gates: in-session `parallelOk = estimatedCwPct ≤ 85`, unattended `parallelOk = estimatedCwPct ≤ 60` + `split = estimatedCwPct > 60`. `split` is always `false` for in-session. CW ceiling = 200 K tokens (matches `token-budget.cjs` / `context-meter-config.cjs` / `runway-estimator.cjs`). | m44-d6-pre-spawn-economics | **complete (2026-04-22)** — both mode thresholds asserted under and over the boundary |
| REQ-M44-D6-04 | Every call appends `{type:'economics_decision', ts, task_id, mode, estimatedCwPct, parallelOk, split, confidence, matchedRows}` to `.gsd-t/events/YYYY-MM-DD.jsonl`. Best-effort (silent on FS failure — never fails the estimate). | m44-d6-pre-spawn-economics | **complete (2026-04-22)** — event shape asserted in tests |
| REQ-M44-D6-05 | Calibrated against the live 528-row `token-usage.jsonl` corpus. Per-tier MAE (% of CW ceiling): HIGH 12.89 %, MEDIUM 0.00 % (small-n tautology), LOW 13.08 %, FALLBACK 15.06 %. Known-failure modes documented in the contract (§10). | m44-d6-pre-spawn-economics | **complete (2026-04-22)** — contract v1.0.0 documents measured numbers |
| REQ-M44-D6-06 | Zero external runtime deps (Node built-ins only). D6 is a HINT — D2 owns the final gate decision. | m44-d6-pre-spawn-economics | **complete (2026-04-22)** |

Supporting contract:
- `economics-estimator-contract.md` v1.0.0 — locks estimator interface, confidence tiers, mode-specific thresholds, event schema, known-failure modes, and calibration numbers. Downstream D2 may wire in.

Out of scope for D6:
- CW headroom arithmetic (D2 owns `computeInSessionHeadroom` / `computeUnattendedGate`)
- Dep-graph validation (D4) and file disjointness (D5)
- Writing back to `token-usage.jsonl` (read-only)
- Multi-iter task slicing (D6 recommends `split=true`; the caller plans the iter breakdown)

## M44 Parallel CLI (D2 — Wave 3 integration, 2026-04-23)

Milestone 44 D2 ships the `gsd-t parallel` subcommand: a CLI wrapping the M40 orchestrator with task-level (not just domain-level) parallelism and mode-aware gating math. D2 consumes D1 (DAG), D4 (depgraph validation), D5 (disjointness prover), and D6 (economics estimator) and produces a validated worker plan. Extends — does not replace — the M40 orchestrator.

| REQ-ID | Requirement Summary | Domain | Status |
|--------|---------------------|--------|--------|
| REQ-M44-D2-01 | `bin/gsd-t-parallel.cjs` exports `runParallel({projectDir, mode, milestone, domain, dryRun})` and `runCli(argv, env)`. Node built-ins only; zero external runtime deps. | m44-d2-parallel-cli | **complete (2026-04-23)** |
| REQ-M44-D2-02 | `gsd-t parallel --help` prints usage (flags + gates + modes + contract reference) and exits 0 without side effects. | m44-d2-parallel-cli | **complete (2026-04-23)** |
| REQ-M44-D2-03 | `--mode in-session\|unattended` flag; auto-detect fallback: `GSD_T_UNATTENDED=1` → `unattended`, else `in-session`. Explicit `--mode` overrides env. Additional flags: `--milestone Mxx`, `--domain <name>`, `--dry-run`. | m44-d2-parallel-cli | **complete (2026-04-23)** |
| REQ-M44-D2-04 | `bin/gsd-t-orchestrator-config.cjs` exports `computeInSessionHeadroom({ctxPct, workerCount, summarySize})` → `{ok, reducedCount}`. `ok=true` iff `ctxPct + workerCount × summarySize ≤ 85`; otherwise reduce N until it fits. Final floor is N=1 — NEVER returns `ok=false` (in-session must never throw pause/resume). | m44-d2-parallel-cli | **complete (2026-04-23)** |
| REQ-M44-D2-05 | `bin/gsd-t-orchestrator-config.cjs` exports `computeUnattendedGate({estimatedCwPct, threshold=60})` → `{ok, split}`. `split=true` when `estimatedCwPct > threshold`; caller MUST slice into multiple iters. Actual slicing is orchestrator responsibility. | m44-d2-parallel-cli | **complete (2026-04-23)** |
| REQ-M44-D2-06 | `runParallel` wires three gates in sequence BEFORE any fan-out: D4 depgraph → D5 disjointness → D6 economics. Any veto emits `gate_veto` event `{type, task_id, gate, reason, ts}` and the task drops from the parallel batch (decision="sequential" or "veto-deps"). | m44-d2-parallel-cli | **complete (2026-04-23)** |
| REQ-M44-D2-07 | In-session mode reads `ctxPct` from `bin/token-budget.cjs::getSessionStatus()`. On reduction (`reducedCount < workerCount`), emits `parallelism_reduced` event `{type, original_count, reduced_count, reason:'in_session_headroom', ts}`. | m44-d2-parallel-cli | **complete (2026-04-23)** |
| REQ-M44-D2-08 | Unattended mode calls D6 `estimateTaskFootprint` per task + `computeUnattendedGate`. On split, emits `task_split` event `{type, task_id, estimatedCwPct, ts}`. | m44-d2-parallel-cli | **complete (2026-04-23)** |
| REQ-M44-D2-09 | `--dry-run` prints a fixed-width 6-column plan table (`task_id`, `domain`, `estimated CW%`, `disjoint?`, `deps ok?`, `decision`) followed by total worker count and mode; exits without spawning any workers. | m44-d2-parallel-cli | **complete (2026-04-23)** |
| REQ-M44-D2-10 | `.gsd-t/contracts/wave-join-contract.md` bumped v1.0.0 → v1.1.0 with §Mode-Aware Gating Math documenting both thresholds, `reducedCount` fallback behavior, the three event schemas, and invariant preservation. | m44-d2-parallel-cli | **complete (2026-04-23)** |

Supporting contract:
- `wave-join-contract.md` v1.1.0 — M44 D2 addendum locks the gating math surface, thresholds, and event schemas.

Out of scope for D2:
- Command file wiring (`commands/gsd-t-execute.md`, `gsd-t-wave.md`, etc.) — that is D3
- Actual task slicing implementation (D2 only emits `task_split`; orchestrator executes)
- Replacing or rewriting `bin/gsd-t-orchestrator.js` — M44 builds on M40

## M44 Command-File Integration (D3 — Wave 3, 2026-04-23)

Milestone 44 D3 wires the five primary GSD-T command files to the D2 `gsd-t parallel` CLI so task-level parallel dispatch becomes available from the standard workflow. D3 is purely additive doc-ripple + integration blocks — no new library code, no new spawns. Existing sequential code paths remain intact; the parallel path is a conditional that falls back silently when any gate vetoes or when only a single task is pending.

| REQ-ID | Requirement Summary | Domain | Status |
|--------|---------------------|--------|--------|
| REQ-M44-D3-01 | `commands/gsd-t-execute.md` Step 3 gains an "Optional — Parallel Dispatch (M44)" block documenting the >1-pending-task + D4/D5/D6 gate conditional, `GSD_T_UNATTENDED` mode auto-detection (no hardcoded `--mode`), silent fallback to sequential, D2-owned observability, unattended zero-compaction invariant, and in-session never-interrupt invariant. | m44-d3-command-file-integration | **complete (2026-04-23)** |
| REQ-M44-D3-02 | `commands/gsd-t-wave.md` EXECUTE phase (Step 3 Phase Orchestration Loop) documents that the spawned execute agent owns the parallel-vs-sequential decision internally; wave orchestrator inherits `GSD_T_UNATTENDED` and does not configure mode. | m44-d3-command-file-integration | **complete (2026-04-23)** |
| REQ-M44-D3-03 | `commands/gsd-t-integrate.md` Step 3 (Wire Integration Points) gains a conditional block triggering only when integrating >1 domain simultaneously; single-domain wiring is unchanged. | m44-d3-command-file-integration | **complete (2026-04-23)** |
| REQ-M44-D3-04 | `commands/gsd-t-quick.md` Step 3 (Execute) gains a lightweight conditional block — no-op for single-task quick invocations (the common case); triggers only when >1 pending task AND all gates pass. | m44-d3-command-file-integration | **complete (2026-04-23)** |
| REQ-M44-D3-05 | `commands/gsd-t-debug.md` Step 3 (Debug Solo or Team) gains a conditional block triggering only for multi-domain contract-boundary/gap debug sessions; single-domain debug runs unchanged. | m44-d3-command-file-integration | **complete (2026-04-23)** |
| REQ-M44-D3-06 | `commands/gsd-t-help.md` documents the `gsd-t parallel` CLI entry and detailed command block mirroring the style of adjacent entries (flags, reads/writes, contract reference). | m44-d3-command-file-integration | **complete (2026-04-23)** |
| REQ-M44-D3-07 | `docs/GSD-T-README.md` commands table reflects M44 D3 parallel-dispatch behavior in the rows for execute, wave, quick, debug, and integrate (1-line note per command). | m44-d3-command-file-integration | **complete (2026-04-23)** |
| REQ-M44-D3-08 | `README.md` Workflow Phases table mentions task-level parallelism via `gsd-t parallel --help` in the Execute row. | m44-d3-command-file-integration | **complete (2026-04-23)** |
| REQ-M44-D3-09 | No command file hardcodes `--mode` — every integration block explicitly states that mode is auto-detected from `GSD_T_UNATTENDED=1`. No `--in-session` opt-out flag exists in any of the 5 command files. | m44-d3-command-file-integration | **complete (2026-04-23)** |
| REQ-M44-D3-10 | `docs/architecture.md` documents the parallel dispatch decision flow (command file → D2 `gsd-t parallel` → D4/D5/D6 gates → M40 orchestrator → workers) as a single authoritative diagram. | m44-d3-command-file-integration | **complete (2026-04-23)** |

Supporting contract:
- `wave-join-contract.md` v1.1.0 — the D2 CLI surface referenced by every D3 integration block.

Out of scope for D3:
- The parallel execution logic (D2 owns it)
- Any gate logic (D4 depgraph, D5 file-disjointness, D6 economics)
- Modifying `bin/gsd-t.js` or any other CLI router (D2-owned)
- Creating new test files — command files are validated by use per project CLAUDE.md conventions
- Modifying the commands' non-parallel code paths — integration blocks are ADDITIVE only

## M44 Spawn Plan Visibility (D8 — Wave 3 observability, 2026-04-23)

Milestone 44 D8 delivers a right-side two-layer task panel in the dashboard and transcript visualizer. Layer 1 surfaces the full project/milestone task plan; Layer 2 scopes down to the currently-active spawn. Done tasks display a compact token cell (`in=Nk out=Nk $X.XX`). A post-commit git hook flips task status to `done` and performs token attribution by scanning `.gsd-t/token-log.md` rows within the spawn's time window. One protocol, three writers (`captureSpawn`, `autoSpawnHeadless`, unattended worker resume Step 0), one reader (dashboard SSE + transcript HTML panel).

| REQ-ID | Requirement Summary | Domain | Status |
|--------|---------------------|--------|--------|
| REQ-M44-D8-01 | `bin/spawn-plan-writer.cjs` exports `writeSpawnPlan({spawnId, kind, milestone, wave, domains, tasks, projectDir})` with atomic temp+rename writes into `.gsd-t/spawns/{spawnId}.json`. | m44-d8-spawn-plan-visibility | **complete (2026-04-23)** |
| REQ-M44-D8-02 | `bin/spawn-plan-status-updater.cjs` exports `markTaskDone({spawnId, taskId, commit, tokens?, projectDir})` and `markSpawnEnded({spawnId, endedReason, projectDir})` with atomic rewrites. | m44-d8-spawn-plan-visibility | **complete (2026-04-23)** |
| REQ-M44-D8-03 | Post-commit hook (`scripts/gsd-t-post-commit-spawn-plan.sh` + template `templates/hooks/post-commit-spawn-plan.sh`) greps commit messages for `[M\d+-D\d+-T\d+]` matches and flips matching tasks in every active spawn plan (where `endedAt === null`). Silent-fail (exit 0) on any error. | m44-d8-spawn-plan-visibility | **complete (2026-04-23)** |
| REQ-M44-D8-04 | Token attribution: hook parses `.gsd-t/token-log.md` rows where `Task` column matches the task id AND `Datetime-start >= spawn.startedAt`, sums `in/out/cr/cc/cost_usd`, writes to the task's `tokens` field. Null renders as `—` per the "zero is a measurement, dash is a gap" rule. | m44-d8-spawn-plan-visibility | **complete (2026-04-23)** |
| REQ-M44-D8-05 | Writer integration at 3 chokepoints — `bin/gsd-t-token-capture.cjs` `captureSpawn` calls `writeSpawnPlan` before `spawnFn()` and `markSpawnEnded` after (success + error both); `bin/headless-auto-spawn.cjs` before child launch; `commands/gsd-t-resume.md` Step 0 under `GSD_T_UNATTENDED_WORKER=1`. All try/catch-wrapped — writer failure never blocks the spawn. | m44-d8-spawn-plan-visibility | **complete (2026-04-23)** |
| REQ-M44-D8-06 | `bin/spawn-plan-derive.cjs` exports `derivePlanFromPartition({projectDir, milestone, currentIter})` that reads `.gsd-t/partition.md` + `.gsd-t/domains/*/tasks.md` and returns the `{wave, domains, tasks}` slice for the current incomplete-tasks wave. | m44-d8-spawn-plan-visibility | **complete (2026-04-23)** |
| REQ-M44-D8-07 | Dashboard server gains `GET /api/spawn-plans` (returns array of plan files where `endedAt === null`) and a `spawn-plan-update` SSE channel (fs.watch on `.gsd-t/spawns/*.json` with mtime-deduplicated emits). Additive — existing endpoints and SSE channels unchanged. | m44-d8-spawn-plan-visibility | **complete (2026-04-23)** |
| REQ-M44-D8-08 | `scripts/gsd-t-transcript.html` gains a right-side `<aside class="spawn-panel">` with two `<section>` layers, status icons `☐ ◐ ✓` (only one `◐` per spawn at a time), and the `fmtTokens({in,out,cr,cc,cost_usd})` renderer producing `in=12.5k out=1.7k $0.42` with k-suffix above 1000 and 2-decimal USD. Cumulative totals computed at milestone and spawn scope. | m44-d8-spawn-plan-visibility | **complete (2026-04-23)** |
| REQ-M44-D8-09 | No new LLM token cost — all writers derive plans deterministically from partition.md + tasks.md; reader is browser-only; status updater is shell + node. | m44-d8-spawn-plan-visibility | **complete (2026-04-23)** |
| REQ-M44-D8-10 | 5 test suites covering writer, status updater, post-commit hook (including token-log attribution), dashboard endpoint + SSE, and transcript renderer panel — 36 tests, all passing. | m44-d8-spawn-plan-visibility | **complete (2026-04-23)** |

Supporting contract:
- `.gsd-t/contracts/spawn-plan-contract.md` v1.0.0 — schema + writer/reader/updater protocol + silent-fail rules.

### M46 D2 Worker Sub-Dispatch

A supervisor worker iteration assigned more than one ready task MUST fan those tasks out as concurrent sub-workers via the M44-verified `runDispatch` instrument rather than running them serially, provided the task set is pairwise file-disjoint and the iteration is running inside an unattended worker child (`GSD_T_UNATTENDED_WORKER=1`). This closes the parallelism gap where unattended workers historically executed their assigned tasks one-at-a-time even when the disjointness precondition held, defeating the purpose of the M44 dispatch infrastructure for all unattended runs. The sub-dispatch path is a new consumer of `bin/gsd-t-parallel.cjs::runDispatch` — no changes to the in-session planner's call site, no new disjointness predicate, and no new dispatch logic. Distinguished in telemetry via the new spawn-plan `kind: 'unattended-worker-sub'` value.

Acceptance:
- `bin/gsd-t-worker-dispatch.cjs` exists and exports `dispatchWorkerTasks` plus the `_areFileDisjoint` helper and the `SPAWN_PLAN_KIND` constant (`'unattended-worker-sub'`).
- Unit + integration tests in `test/m46-d2-worker-subdispatch.test.js` pass (trigger-condition matrix, disjointness predicate, runDispatch delegation, spawn-plan frame emission, serial fallback on overlap/single-task).
- Proof measurement recorded in `.gsd-t/metrics/m46-worker-proof.json` shows a parallel-vs-serial speedup of at least **2.5×** on a representative file-disjoint worker iteration.
- `.gsd-t/contracts/headless-default-contract.md` v2.1.0 §Worker Sub-Dispatch present as the locked source of truth.

### M46 D1 Iteration Parallelism

The unattended supervisor main loop MUST expose iter-level parallelism machinery via four extracted helpers — `_runOneIter`, `_computeIterBatchSize`, `_runIterParallel`, `_reconcile` — so unit tests and future callers can exercise batched iteration deterministically, with `_runIterParallel` using `Promise.allSettled` so a single rejected slice does not cancel siblings and `_reconcile` merging `IterResult[]` into state with append-only `completedTasks`, last-writer-wins `status`, OR across `verifyNeeded`, append on `artifacts`, and overwrite `lastBatch` metadata. The production main loop default remains serial (`batchSize = 1` always, via `_computeIterBatchSize` returning `1` whenever `opts.maxIterParallel` is not a number) pending the state-clone-safety follow-up tracked in backlog #24 — that work must land before the supervisor CLI sets a non-1 default.

Acceptance:
- `_runOneIter`, `_computeIterBatchSize`, `_runIterParallel`, and `_reconcile` are all exported via `module.exports.__test__` on `bin/gsd-t-unattended.cjs`.
- Tests in `test/m46-d1-iter-parallel.test.js` pass (serial fallback, parallel batch, mode-safety gate, error isolation, state reconciliation).
- Proof speedup ≥ **3.0×** recorded in `.gsd-t/metrics/m46-iter-proof.json` — a synthetic `batchSize = 4` measurement of the `_runIterParallel` driver, not the production main loop (which remains serial until backlog #24 lands).
- `.gsd-t/contracts/iter-parallel-contract.md` v1.0.0 present as the locked source of truth.

## M47 Focused Visualizer Redesign (executed — 2026-05-06)

| REQ-ID | Requirement Summary | Domain | Task(s) | Status |
|--------|---------------------|--------|---------|--------|
| REQ-M47-D1-01 | Default `/transcripts` landing shows the main in-session conversation streaming in the top pane within 3s, zero clicks (success criterion 1). | m47-d1-viewer-redesign | T2, T4 | done |
| REQ-M47-D1-02 | Click any rail entry → loads it into the bottom pane within 1s; `gsd-t.viewer.selectedSpawnId` sessionStorage key persists selection across reload (success criterion 2). | m47-d1-viewer-redesign | T3, T5 | done |
| REQ-M47-D1-03 | Reactive Live → Completed transition without full reload; if the user is currently focused on the transitioning spawn, focus stays (no auto-revert) (success criterion 3). | m47-d1-viewer-redesign | T5 | done |
| REQ-M47-D1-04 | Completed section displays at least 100 historical spawns capped, sorted newest-first, with status badges; toggle collapses/expands; `gsd-t.viewer.completedExpanded` persists state (success criterion 4). | m47-d1-viewer-redesign | T3, T5 | done |
| REQ-M47-D1-05 | Splitter is mouse-draggable + keyboard-accessible (ArrowUp/Down ±5%, Home/End snap to 20/80); position persists in `gsd-t.viewer.splitterPct` sessionStorage. | m47-d1-viewer-redesign | T2, T6 | done |
| REQ-M47-D1-06 | Right rail (Spawn Plan / Parallelism / Tool Cost) preserved under collapsible toggle; `gsd-t.viewer.rightRailCollapsed` sessionStorage key. | m47-d1-viewer-redesign | T2 | done |
| REQ-M47-D1-07 | Back-compat: `data-spawn-id="__SPAWN_ID__"` server-side substitution preserved; bookmarks to `/transcript/:spawnId` land with that spawn pre-selected in the bottom pane. Existing 7 viewer-route/HTML tests stay green. | m47-d1-viewer-redesign | T2, T7 | done |
| REQ-M47-D2-01 | `listInSessionTranscripts` (and the merged `handleTranscriptsList` payload) returns each in-session entry with `status: 'active' \| 'completed'` derived from a 30s mtime window. | m47-d2-server-helpers | T1, T4 | done |
| REQ-M47-D2-02 | New `GET /api/main-session` endpoint returns `{ filename, sessionId, mtimeMs }` for the most-recently-modified `in-session-*.ndjson` (or `{ null, null, null }` when none exist); path-traversal-guarded; no caching. | m47-d2-server-helpers | T2, T5 | done |
| REQ-M47-D2-03 | `dashboard-server-contract.md` bumped to v1.3.0 documenting the additive `status` field semantics + `/api/main-session` schema; module exports updated. | m47-d2-server-helpers | T3 | done |
| REQ-M47-D2-04 | Test suite passes baseline 2045/2047 + new M47 tests (D1 + D2 net add); no NEW regressions in the 7 existing viewer-route/HTML tests (success criterion 5). | m47-d1-viewer-redesign + m47-d2-server-helpers | D1 T7, D2 T4–T5 | done |


## M50 Universal Playwright Bootstrap + Deterministic UI Enforcement (planned — 2026-05-06)

| REQ-ID | Requirement Summary | Domain | Task(s) | Status |
|--------|---------------------|--------|---------|--------|
| REQ-M50-D1-01 | `bin/playwright-bootstrap.cjs` exports `hasPlaywright`, `detectPackageManager`, `installPlaywright` (idempotent), `verifyPlaywrightHealth`. Zero external runtime deps. | m50-bootstrap-and-detection | T2, T3 | done |
| REQ-M50-D1-02 | `bin/ui-detection.cjs` exports `hasUI` (depth-bounded, short-circuits on first hit) + `detectUIFlavor`. Recognizes React/Vue/Svelte/Next/Angular/Flutter/Tailwind/css-only. | m50-bootstrap-and-detection | T1 | done |
| REQ-M50-D1-03 | `bin/gsd-t.js` migrates inline `hasPlaywright` (line 201-204) to `require('./playwright-bootstrap.cjs')`; `init`/`update-all`/`doctor` invoke `installPlaywright` when `hasUI && !hasPlaywright`. | m50-bootstrap-and-detection | T4 | done |
| REQ-M50-D1-04 | New `gsd-t setup-playwright` subcommand: explicit one-shot `installPlaywright(cwd)` invocation with verbose output. | m50-bootstrap-and-detection | T4 | done |
| REQ-M50-D1-05 | New flag `gsd-t doctor --install-playwright` directly invokes `installPlaywright(cwd)`. Fixes all 14 of 19 registered projects flagged Playwright-missing in one command. | m50-bootstrap-and-detection | T4 | done |
| REQ-M50-D1-06 | ~25 unit tests across `test/m50-d1-playwright-bootstrap.test.js` + `test/m50-d1-ui-detection.test.js` + `test/m50-d1-cli-integration.test.js` pass. | m50-bootstrap-and-detection | T1, T2, T3, T4, T5 | done |
| REQ-M50-D2-01 | `bin/headless-auto-spawn.cjs::autoSpawnHeadless()` inserts a spawn-gate: when `isTestingOrUICommand && hasUI && !hasPlaywright`, auto-installs; on install fail, exits with `mode: 'blocked-needs-human'` (exit code 4). Hot-path overhead ≤ 10ms when no install is needed. | m50-gates-and-specs | T2 | done |
| REQ-M50-D2-02 | `scripts/hooks/pre-commit-playwright-gate` (opt-in via `gsd-t doctor --install-hooks`) reads `.gsd-t/.last-playwright-pass` and blocks viewer-source commits when any touched viewer-source file's mtime > the timestamp. Fail-open on config errors. | m50-gates-and-specs | T3 | done |
| REQ-M50-D2-03 | `playwright.config.ts` at GSD-T project root with `testDir: 'e2e'`, chromium project, `webServer: undefined` (specs manage their own server lifecycle). | m50-gates-and-specs | T1 | done |
| REQ-M50-D2-04 | `e2e/viewer/title.spec.ts` regression-tests M48 Bug 1 (project basename in `<title>` + header `.title` for `/transcripts` and `/transcripts/{spawnId}`). | m50-gates-and-specs | T4 | done |
| REQ-M50-D2-05 | `e2e/viewer/timestamps.spec.ts` regression-tests M48 Bug 2 (per-frame timestamps from `frame.ts`, not per-batch `new Date()`). | m50-gates-and-specs | T5 | done |
| REQ-M50-D2-06 | `e2e/viewer/chat-bubbles.spec.ts` regression-tests M48 Bug 3 (`user_turn`/`assistant_turn`/`session_start`/`tool_use_line` render as styled bubbles, not `JSON.stringify` dumps). | m50-gates-and-specs | T6 | done |
| REQ-M50-D2-07 | `e2e/viewer/dual-pane.spec.ts` regression-tests M48 Bug 4 (clicking `in-session-*` rail entry pins to top pane only; bottom pane stays on its own SSE stream). | m50-gates-and-specs | T7 | done |
| REQ-M50-D2-08 | `e2e/viewer/lazy-dashboard.spec.ts` regression-tests M49 banner (URL banner when dashboard alive; fallback "Transcript file:" banner when not). | m50-gates-and-specs | T8 | done |
| REQ-M50-D2-09 | ~14 unit tests across `test/m50-d2-spawn-gate.test.js` + `test/m50-d2-pre-commit-hook.test.js` + `test/m50-d2-viewer-specs-smoke.test.js` pass. | m50-gates-and-specs | T1, T2, T3 | done |
| REQ-M50-D2-10 | Doc-ripple: `~/.claude/CLAUDE.md` + `templates/CLAUDE-global.md` + 8 command files (`gsd-t-execute`, `gsd-t-test-sync`, `gsd-t-verify`, `gsd-t-quick`, `gsd-t-wave`, `gsd-t-milestone`, `gsd-t-complete-milestone`, `gsd-t-debug`) + `docs/architecture.md` + `CHANGELOG.md`. Replace prose Playwright reminders with referrals to `playwright-bootstrap-contract.md`. | m50-gates-and-specs | T9 | done |
| REQ-M50-VERIFY | Full unit suite: 2104 baseline + ~25 D1 + ~14 D2 = ~2143 expected, ≥2141 passing (preserves 2 known env-sensitive flakes). All 5 E2E specs pass. Spawn-gate fixture + pre-commit-hook fixture pass. | both | T10 (D2) | done |

Supporting contracts:
- `.gsd-t/contracts/playwright-bootstrap-contract.md` v1.0.0 — D1 library API + CLI wiring + idempotency invariants + error-path contract.
- `.gsd-t/contracts/m50-integration-points.md` — D1↔D2 cross-domain checkpoint, the `bin/gsd-t.js` file-overlap coordination rules, and the doc-ripple ordering.


## M52 Rigorous User-Journey Coverage + Anti-Drift Test Quality (planned — 2026-05-06)

| REQ-ID | Requirement Summary | Domain | Task(s) | Status |
|--------|---------------------|--------|---------|--------|
| REQ-M52-D1-01 | `bin/journey-coverage.cjs` walks `scripts/gsd-t-transcript.html` for every interactive listener (click, keydown, change, mousedown, drag, hashchange) and emits a normalized listing keyed by selector + event. | m52-d1-journey-coverage-tooling | T1 | done |
| REQ-M52-D1-02 | `bin/journey-coverage.cjs` cross-references the listener listing against `e2e/journeys/*.spec.ts` to verify each listener has a corresponding journey spec asserting state change; reports missing-coverage rows; exits non-zero on gaps. | m52-d1-journey-coverage-tooling | T1, T3 | done (T1 detector + findGaps; CLI exit codes pending T3) |
| REQ-M52-D1-03 | `journey-coverage-contract.md` (manifest schema + listener-pattern catalogue + gap rules + exit codes) STABLE; `.gsd-t/journey-manifest.json` (D2-authored) is the canonical enumeration of interactive viewer surfaces — supersedes the originally-proposed standalone `JOURNEYS.md` file. | m52-d1-journey-coverage-tooling | T2 | done |
| REQ-M52-D1-04 | `scripts/hooks/pre-commit-journey-coverage` (auto-installed by `gsd-t install` and re-installable via `gsd-t doctor --install-journey-hook`, same shape as `pre-commit-playwright-gate`) blocks commits when viewer-source files are staged AND `bin/journey-coverage-cli.cjs --staged-only` reports uncovered surfaces. Fail-open on detector internal exception. | m52-d1-journey-coverage-tooling | T4 | done |
| REQ-M52-D1-05 | `bin/gsd-t.js` wired with `installJourneyCoverageHook`, `check-coverage` subcommand, install-flow autoinstall, and `--install-journey-hook` doctor flag. Idempotent marker. | m52-d1-journey-coverage-tooling | T5 | done |
| REQ-M52-D2-01 | 12 inaugural journey specs land in `e2e/journeys/`: `main-session-stream`, `click-completed-conversation`, `click-spawn-entry`, `splitter-drag`, `splitter-keyboard`, `right-rail-toggle`, `completed-collapse-toggle`, `auto-follow-toggle`, `kill-button`, `sessionstorage-persistence`, `keyboard-shortcuts`, `hashchange`. Every assertion proves user-visible state change (no `toBeVisible`-only specs). | m52-d2-journey-specs-and-fixtures | T2, T3, T4 | done |
| REQ-M52-D2-02 | All 12 journey specs pass against the v3.22.x viewer (`scripts/gsd-t-transcript.html` + `scripts/gsd-t-dashboard-server.js`); `.gsd-t/journey-manifest.json` has 12 entries 1:1 with the spec files; `gsd-t check-coverage` exit 0. | m52-d2-journey-specs-and-fixtures | T4 | done |
| REQ-M52-D3-01 | `templates/prompts/red-team-subagent.md` adds new mandatory category "Test Pass-Through — Journey Edition": for each journey spec, the adversary writes a deliberately-broken viewer impl that breaks the journey but satisfies the literal assertions of another spec. Each pass-through is a spec failure → tighten. | m52-d2-journey-specs-and-fixtures | T5 | done |
| REQ-M52-D3-02 | M52 D2 Red Team run: ≥5 broken impls written against the 12 D2 journey specs; all caught; findings logged to `.gsd-t/red-team-report.md` § "M52 JOURNEY-EDITION RED TEAM"; pre-commit-journey-coverage hook exercised end-to-end (block + unblock paths). | m52-d2-journey-specs-and-fixtures | T5 | done |
| REQ-M52-D4-01 | `e2e/fixtures/journeys/` ships 3 real-data NDJSONs sliced from `.gsd-t/transcripts/in-session-*.ndjson`: `fixture-medium-session.ndjson` (~50 frames), `fixture-completed-session.ndjson` (~150 frames), `fixture-multi-spawn.ndjson` (~80 frames across 3 spawns). PII scrub applied. | m52-d2-journey-specs-and-fixtures | T1 | done |
| REQ-M52-D4-02 | `e2e/fixtures/journeys/replay-helpers.ts` exports `replayFixture(page, fixturePath)` that drives at least 3 of the 12 journey specs end-to-end via fixture replay and asserts: page renders without errors, frame count matches expected, scrolling works, no `[object Object]`/`undefined` literals visible, all bubble types render correctly. | m52-d2-journey-specs-and-fixtures | T1, T2 | done (replay-helpers shipped + main-session-stream uses fixture-medium-session via startReplayServer) |
| REQ-M52-D5-01 | Doc-ripple: `~/.claude/CLAUDE.md` E2E Test Quality Standard rewritten to formally define "rigorous" (every interactive surface clicked, every assertion proves visible state change, journey specs not unit tests in browser clothing, real-data fixtures, adversarial Red Team on journeys); `templates/CLAUDE-global.md` matches; `commands/gsd-t-debug.md` + `gsd-t-execute.md` + `gsd-t-quick.md` + `gsd-t-verify.md` reference `journey-coverage.cjs` zero-gap requirement; `docs/architecture.md` adds "Journey Coverage Enforcement (M52)" section. | m52-d1-journey-coverage-tooling | T5 | done (architecture.md + CHANGELOG.md ripple completed during /gsd-t-verify; CLAUDE-global E2E Test Quality Standard already defines "functional behavior over element existence" — same doctrine M52 enforces mechanically) |
| REQ-M52-VERIFY | Full unit suite 2166 baseline preserved + 12 journey specs + 3 real-data fixture replays all green; `gsd-t check-coverage` reports zero gaps; pre-commit-journey-coverage hook blocks deliberate test-commit-without-spec; Red Team finds ≥5 breakages, all caught; CHANGELOG entry written. | both | D1 T5, D2 T5 | done (unit 2195/2195, E2E 35/35 + 1 skip, `gsd-t check-coverage` exit 0, hook end-to-end exercised, Red Team 5/5 caught, CHANGELOG entry written) |

## M54 Live Activity Visibility (planned — 2026-05-07)

| ID | Requirement | Domain | Tasks | Status |
|----|-------------|--------|-------|--------|
| REQ-M54-D1-01 | `bin/live-activity-report.cjs` exports `computeLiveActivities({projectDir, now?})` returning `{schemaVersion: 1, generatedAt, activities: [{id, kind, label, startedAt, durationMs, tailUrl, alive}]}`. Detects 4 kinds: `bash` (run_in_background sentinel in events JSONL or orchestrator JSONL with no matching tool_result), `monitor` (Monitor tool start/stop pairing), `tool` (any tool_use > 30s old without tool_result), `spawn` (read-through to existing `.gsd-t/spawns/*.json` plan files). Pure read-only; silent-fail invariant — malformed JSONL, missing slug, unreadable file return partial data with notes, never throw. | m54-d1-server-and-detector | T1, T2 | done |
| REQ-M54-D1-02 | Source-of-truth UNION: `.gsd-t/events/*.jsonl` (project-local heartbeat) + `~/.claude/projects/<slug>/<sid>.jsonl` (Claude Code orchestrator transcript). Slug discovered via existing `_slugFromTranscriptPath` / `_slugToProjectDir` helpers in `scripts/hooks/gsd-t-conversation-capture.js`. Activities deduped by `tool_use_id` (preferred) then by `(kind, label, startedAt)` tuple as fallback. | m54-d1-server-and-detector | T2 | done |
| REQ-M54-D1-03 | Liveness check uses 3 falsifiers in priority order: (1) explicit terminating event arrived (tool_result, monitor_stopped, spawn_completed); (2) PID check fails (`process.kill(pid, 0)` throws ESRCH) for kinds with a recorded PID; (3) source file mtime > 60s old. Entry leaves `activities[]` when ANY falsifier returns true. | m54-d1-server-and-detector | T2 | done |
| REQ-M54-D1-04 | `scripts/gsd-t-dashboard-server.js` adds 3 handlers + URL routes: `GET /api/live-activity` (5s response cache, mirrors `/api/parallelism` shape — silent-fail returns 500 only on contract regression, never on data malformation); `GET /api/live-activity/<id>/tail` (last ~64 KB stdout/stderr for bash, last 200 lines for monitor; per-id 5s cache); `GET /api/live-activity/<id>/stream` (SSE that follows the tail). All routes guard `<id>` against path traversal. | m54-d1-server-and-detector | T3 | done |
| REQ-M54-D1-05 | `bin/gsd-t.js` `GLOBAL_BIN_TOOLS` array gains `"live-activity-report.cjs"` so the global dashboard at `~/.claude/scripts/gsd-t-dashboard-server.js` resolves it from `~/.claude/bin/live-activity-report.cjs` (mirror v3.23.11 install path for `parallelism-report.cjs`). Doctor `checkDoctorGlobalBin()` automatically covers it. | m54-d1-server-and-detector | T4 | done |
| REQ-M54-D1-06 | `.gsd-t/contracts/live-activity-contract.md` v1.0.0 STABLE — documents the 4 kinds, dedup rules, liveness falsifiers, JSON schema, all 3 endpoints, cache invariants, silent-fail invariant. Entries 1:1 with code constants. | m54-d1-server-and-detector | T5 | done |
| REQ-M54-D2-01 | `scripts/gsd-t-transcript.html` adds new left-rail section "LIVE ACTIVITY" between MAIN SESSION and LIVE SPAWNS. Each entry rendered as: status dot (green=running, dimmed=stale-but-not-yet-removed) · kind icon (`$` bash, `👁` monitor, `🔧` tool, `↳` spawn) · 40-char truncated label · live wall-clock duration counter · pulsing border for first 30s of life or until clicked. CSS @keyframes accent-pulse, ~1.5s cycle, scoped to a `.la-pulsing` class only. | m54-d2-rail-and-spec | T1, T2 | done |
| REQ-M54-D2-02 | Rail polls `GET /api/live-activity` every 5 seconds (matches existing `/api/parallelism` cadence). On new entry: append + add `.la-pulsing`. Pulse stops when (a) user clicks the entry, (b) entry no longer in the next response, or (c) 30 seconds elapse. Click handler loads bottom pane with the entry's tail (`tailUrl` from response). NO auto-switch of the bottom pane on entry arrival — only the pulse signals attention. | m54-d2-rail-and-spec | T2 | done |
| REQ-M54-D2-03 | LIVE SPAWNS data continues to populate (D1 returns `kind: "spawn"` entries) but visually nests as a sub-grouping inside LIVE ACTIVITY. Existing MAIN SESSION + COMPLETED rendering, journey specs, and contract semantics UNCHANGED. | m54-d2-rail-and-spec | T1 | done |
| REQ-M54-D2-04 | Two new live-journey specs under `e2e/live-journeys/` (post-M52 doctrine — probe the running dashboard, not in-process startServer fixtures): `live-activity.spec.ts` (real `bash -c "sleep 30"` via `child_process.spawn`; assert /api/live-activity returns it within 5s, rail entry appears within 5s with `.la-pulsing`, duration counter ticks, click loads tail, kill → entry disappears within 5s; self-skip when no live dashboard reachable); `live-activity-multikind.spec.ts` (real Monitor + bash backgrounder + synthetic tool_use_started event in `.gsd-t/events/<today>.jsonl`; assert all 3 appear, pulse independently, dedupe correctly when one is also in orchestrator JSONL). | m54-d2-rail-and-spec | T3 | done |
| REQ-M54-D2-05 | `.gsd-t/journey-manifest.json` gains 2 new entries (covers includes li:click from new polling JS). `gsd-t check-coverage` reports `OK: 21 listeners, 16 specs`. | m54-d2-rail-and-spec | T3 | done |
| REQ-M54-VERIFY | Full unit suite ≥ 2233 baseline + ≥15 new D1 unit tests across `test/m54-d1-live-activity-report.test.js` and `test/m54-d1-dashboard-handlers.test.js` (silent-fail on malformed JSONL, dedupe by tool_use_id, PID-check fallback, file-mtime fallback, 4 kind detectors, `<id>` path-traversal rejection, 5s cache hits/misses) all green; both live-journey specs pass against the running dashboard (or self-skip in CI); Red Team writes ≥5 broken patches (dedupe-disabled, PID-stub-true, mtime-fallback-removed, pulse-never-clears, tool_use_id-collision-unhandled), each caught by D2 journey or D1 unit suite (GRUDGING PASS); CHANGELOG entry written; `docs/architecture.md` adds "Live Activity Observability (M54)" section. | both | D1 T5, D2 T3 | done |

Supporting contracts (to be written during D1):
- `.gsd-t/contracts/journey-coverage-contract.md` (proposed) — listener detector API, gap-report schema, pre-commit hook semantics, JOURNEYS.md schema.

## M55 CLI-Preflight Pattern + Parallel-CLI Substrate + Verify Gate (planned — 2026-05-09)

| ID | Requirement | Domain | Tasks | Status |
|----|-------------|--------|-------|--------|
| REQ-M55-D1-01 | `bin/cli-preflight.cjs` exports `runPreflight({projectDir, checks?, mode?})` returning `{schemaVersion: '1.0.0', ok, checks: [], notes: []}`. Pluggable, deterministic, zero-dep. Synchronous. Per-check throws caught and recorded. Sorted output. | m55-d1-state-precondition-library | T1, T2 | done |
| REQ-M55-D1-02 | 6 built-in checks under `bin/cli-preflight-checks/`: `branch-guard` (severity:error), `contracts-stable` (warn), `deps-installed` (warn), `manifest-fresh` (info), `ports-free` (error), `working-tree-state` (warn). Each check is a single-file drop-in. | m55-d1-state-precondition-library | T3, T4 | done |
| REQ-M55-D1-03 | CLI form: `node bin/cli-preflight.cjs [--project DIR] [--json \| --text] [--skip id1,id2]`. Exit 0 on ok; 4 on fail. captureSpawn-exempt per contract § captureSpawn Exemption. | m55-d1-state-precondition-library | T5 | done |
| REQ-M55-D1-04 | `.gsd-t/contracts/cli-preflight-contract.md` v1.0.0 STABLE — envelope schema, severity model, fail-soft, schema-version policy, captureSpawn exemption. | m55-d1-state-precondition-library | T1 | done |
| REQ-M55-D2-01 | `bin/parallel-cli.cjs` exports `runParallel({workers, maxConcurrency, failFast?, teeDir?, …})` returning `{schemaVersion: '1.0.0', ok, wallClockMs, maxConcurrencyApplied, failFast, results[], notes[]}`. Every spawn flows through `captureSpawn`. Results sorted by id ASC. wallClockMs is orchestrator real time. | m55-d2-parallel-cli-substrate | T1, T2 | done |
| REQ-M55-D2-02 | `bin/parallel-cli-tee.cjs` provides per-worker NDJSON tee (file mode + memory mode with 1 MB cap → tmp rotation). Per-worker timeout cancels only that worker; fail-fast SIGTERM in-flight + 5s grace SIGKILL escalation. | m55-d2-parallel-cli-substrate | T3, T4 | done |
| REQ-M55-D2-03 | `bin/m55-substrate-proof.cjs` proof CLI demonstrates ≥3× wall-clock speedup. Recorded measurement: 5.57× (T_serial=1813.3ms vs T_par=325.6ms across N=6 sleep=250ms workers). Numbers persisted to `.gsd-t/metrics/m55-substrate-proof.{txt,json}`. | m55-d2-parallel-cli-substrate | T5, T6 | done |
| REQ-M55-D2-04 | `.gsd-t/contracts/parallel-cli-contract.md` v1.0.0 STABLE — worker spec, envelope shape, determinism rules, fail-fast policy, per-worker timeout, tee paths, captureSpawn invariant, engine-only constraint. | m55-d2-parallel-cli-substrate | T1 | done |
| REQ-M55-D3-01 | `bin/gsd-t-ratelimit-probe.cjs` + worker — synthetic-worker harness mirroring real GSD-T spawn shape. Sweep matrix `{1,2,3,4,5,6,8} workers × {10k,30k,60k,100k} context`. Captures per-worker time-to-first-token, 429 count + which worker, total wall-clock. | m55-d3-ratelimit-probe-map | T2, T4 | done |
| REQ-M55-D3-02 | `.gsd-t/ratelimit-map.json` populated via real Claude Max OAuth one-shot run (28 sweep cells × 3 runs = 84 spawns). Empirical: 28/28 cells run, 22 declared-safe, **0 total 429s**, `peakConcurrency=8`, `safeConcurrencyAt60kContext=5`, `perWorkerContextBudgetTokens=30000`. M55 success criterion 5 satisfied with margin. | m55-d3-ratelimit-probe-map | T6 | done |
| REQ-M55-D3-03 | Account masking enforced (`oauth-c2cc7a8131c440c8` prefix only — never raw token). | m55-d3-ratelimit-probe-map | T1 | done |
| REQ-M55-D3-04 | `.gsd-t/contracts/ratelimit-map-contract.md` v1.0.0 STABLE. | m55-d3-ratelimit-probe-map | T1 | done |
| REQ-M55-D4-01 | `bin/gsd-t-context-brief.cjs` exports `generateBrief({projectDir, kind, domain, spawnId, strict?, now?})` returning a ≤10 KB / ≤2,500-token JSON snapshot. 6 kinds (`design-verify`, `execute`, `qa`, `red-team`, `scan`, `verify`). Pure, zero-dep, captureSpawn-exempt. | m55-d4-context-brief-generator | T2, T3 | done |
| REQ-M55-D4-02 | Schema includes `schemaVersion`, `generatedAt`, `spawnId`, `kind`, `domain`, `sourceMtimes`, `branch`, `contracts`, `scope`, `constraints`, `ancillary`. Top-level keys alphabetical. Hard cap throws rather than silent truncation. | m55-d4-context-brief-generator | T2 | done |
| REQ-M55-D4-03 | Fail-open vs fail-closed per kind: `qa`/`red-team`/`design-verify` fail-CLOSED. `--strict` upgrades fail-open kinds. Path safety: `--domain`/`--spawn-id` accept ONLY `^[a-zA-Z0-9_-]+$`. | m55-d4-context-brief-generator | T2 | done |
| REQ-M55-D4-04 | `.gsd-t/briefs/` and its `.gitignore` shipped. Repo-level `.gitignore` contains `.gsd-t/briefs/`. Briefs are per-spawn ephemera. | m55-d4-context-brief-generator | T6 | done |
| REQ-M55-D4-05 | `.gsd-t/contracts/context-brief-contract.md` v1.0.0 STABLE. | m55-d4-context-brief-generator | T1 | done |
| REQ-M55-D5-01 | `bin/gsd-t-verify-gate.cjs` exports `runVerifyGate({projectDir, …})` running BOTH Track 1 (D1 preflight, hard-fail on severity:error) AND Track 2 (D2 parallel-CLI fan-out: tsc, biome/ruff, npm test, knip, gitleaks, scc/lizard). Returns v1.0.0 envelope with `ok = (skipTrack1 \|\| track1.ok) && (skipTrack2 \|\| track2.ok)`. Defensive on missing `.gsd-t/ratelimit-map.json` → fallback `maxConcurrency=2`. | m55-d5-verify-gate-and-wirein | T3 | done |
| REQ-M55-D5-02 | `bin/gsd-t-verify-gate-judge.cjs` companion produces ≤500-token LLM prompt scaffold from envelope. Judge sees only the deterministic `summary`; never raw stdout/stderr. | m55-d5-verify-gate-and-wirein | T4 | done |
| REQ-M55-D5-03 | CLI form: `gsd-t verify-gate [--project DIR] [--skip-track1] [--skip-track2] [--max-concurrency N] [--fail-fast] [--json]`. Exit 0/4/2/3. Four new dispatch subcommands wired into `bin/gsd-t.js`: `gsd-t preflight`, `gsd-t brief`, `gsd-t verify-gate`, `gsd-t verify-gate-judge`. All four added to `GLOBAL_BIN_TOOLS`. | m55-d5-verify-gate-and-wirein | T7 | done |
| REQ-M55-D5-04 | Wire-ins: `commands/gsd-t-execute.md` Step 1 additive block (preflight + brief invocation, threads `$BRIEF_PATH`); `commands/gsd-t-verify.md` Step 2 additive block (verify-gate invocation, pipes summary to judge); `templates/prompts/{qa,red-team,design-verify}-subagent.md` "brief first" rule. All gated by `<!-- M55-D5: ... -->` marker comments asserted in tests. | m55-d5-verify-gate-and-wirein | T8, T9, T10 | done |
| REQ-M55-D5-05 | 3 wire-in assertion tests (TDD red→green): `test/m55-d5-wire-in-execute.test.js`, `test/m55-d5-wire-in-verify.test.js`, `test/m55-d5-subagent-prompts.test.js` — assert marker presence + canonical command invocations + structural placement. | m55-d5-verify-gate-and-wirein | T2 | done |
| REQ-M55-D5-06 | 3 e2e journey specs covering SC3 (≥3 distinct failure-class blocks): `verify-gate-blocks-wrong-branch.spec.ts`, `verify-gate-blocks-port-conflict.spec.ts`, `verify-gate-blocks-contract-draft.spec.ts`. All 3 in `.gsd-t/journey-manifest.json`. | m55-d5-verify-gate-and-wirein | T11 | done |
| REQ-M55-D5-07 | `.gsd-t/contracts/verify-gate-contract.md` v1.0.0 STABLE — envelope schema, two-track hard-fail rule, ≤500-token summary discipline, head-and-tail snippet rule, raw-output retention path, idempotent-rerun rule, defensive-on-missing-map default, captureSpawn inheritance (NOT exempt). | m55-d5-verify-gate-and-wirein | T1 | done |
| REQ-M55-D5-08 | Doc ripple: `docs/architecture.md` (CLI-Preflight Pattern section), `docs/requirements.md` (this REQ-M55 block), `CLAUDE.md` (Mandatory Preflight Before Spawn + Brief-First Worker Rule), `commands/gsd-t-help.md` (3 new entries), `README.md` (CLI table updates), `templates/CLAUDE-global.md` (preflight/brief/verify-gate documentation block), `~/.claude/CLAUDE.md` (Pre-Commit Gate addition). All in single commit per Document Ripple Completion Gate. | m55-d5-verify-gate-and-wirein | T12, T13 | done |
| REQ-M55-VERIFY | Full unit suite ≥ 2399 baseline (post-D4) + 30+ new D5 unit tests across `test/m55-d5-verify-gate.test.js` (Track 1 hard-fail, Track 2 fan-out mocked, summary truncation ≤500 tokens, schema-version, defensive-on-missing-map, idempotent re-run, sort-determinism, skip flags) + `test/m55-d5-verify-gate-judge.test.js` (cap holds across huge envelopes, malformed-input resilience, deterministic) all green. 3 wire-in tests GREEN after T8/T9/T10 land. 3 e2e journey specs GREEN under Playwright. `gsd-t check-coverage` exit 0. | m55-d5-verify-gate-and-wirein | T14 | done |

## M56 Verify-Gate CLI Fan-Out + Upper-Stage Briefs (planned — 2026-05-09)

| Requirement | Description | Domain | Tasks | Status |
|-------------|-------------|--------|-------|--------|
| REQ-M56-D1-01 | `bin/gsd-t-verify-gate.cjs` Track 2 extends with native CLI workers for `playwright test`, `npm test`, `gsd-t check-coverage` (no Task subagent wrapper). Workers go through `runParallel` from `bin/parallel-cli.cjs` with `captureSpawn` invariant. | m56-d1-verify-gate-native-cli-workers | TBD | planned |
| REQ-M56-D1-02 | M56 records `M55-baseline-tokens` + `M56-actual-tokens` in `.gsd-t/metrics/m56-token-baseline.json` and reports the delta in CHANGELOG (closes M55 SC4 retroactively). | m56-d1-verify-gate-native-cli-workers | TBD | planned |
| REQ-M56-D1-03 | Verify-gate wall-clock ≤ M55's 34s on the same dogfood scenario. Numbers persisted to `.gsd-t/metrics/m56-verify-gate-wallclock.json`. | m56-d1-verify-gate-native-cli-workers | TBD | planned |
| REQ-M56-D2-01 | `bin/gsd-t-context-brief.cjs` extends `KIND_REGISTRY` with 5 new kinds: `partition`, `plan`, `discuss`, `impact`, `milestone`. Each kind has its own file-resolver mapping a brief request to the relevant CLAUDE.md + contract excerpts + scope.md slice. ≤2,500-token cap per brief. | m56-d2-upper-stage-brief-kinds | TBD | planned |
| REQ-M56-D2-02 | Brief generator unit tests cover all 5 new kinds: schema-shape, ≤2,500-token cap honored, missing-input resilience (e.g. milestone kind without a defined milestone falls back to "no milestone defined"), determinism. | m56-d2-upper-stage-brief-kinds | TBD | planned |
| REQ-M56-D3-01 | `commands/gsd-t-{partition,plan,discuss,impact,milestone}.md` Step 1 each thread `$BRIEF_PATH` via the M55 D4 pattern (`SPAWN_ID`, `gsd-t brief --kind …`, `export BRIEF_PATH=…`). Tested via marker-comment assertion (`<!-- M56-D3: brief wire-in -->`). | m56-d3-upper-stage-command-wirein | TBD | planned |
| REQ-M56-D4-01 | `commands/gsd-t-quick.md` and `commands/gsd-t-debug.md` Step 1 invoke `gsd-t preflight --json` (hard-fail on severity:error), then thread `$BRIEF_PATH` via brief generation (kinds `quick`/`debug` already in registry from M55 D4), then call `gsd-t verify-gate` if the operation produced code changes. Tested via marker-comment assertion (`<!-- M56-D4: preflight + brief + verify-gate wire-in -->`). | m56-d4-quick-debug-wirein | TBD | planned |
| REQ-M56-D5-01 | Three known stream-json gaps closed: `bin/gsd-t.js:3879 spawnClaudeSession` (add `--output-format stream-json --verbose`), `bin/gsd-t-parallel.cjs:378` cache-warm probe (same), `bin/gsd-t-ratelimit-probe-worker.cjs:89` (same). | m56-d5-stream-json-universality-lint | TBD | planned |
| REQ-M56-D5-02 | New lint check: extend `bin/gsd-t-capture-lint.cjs` (or sibling `bin/gsd-t-stream-json-lint.cjs`) to mechanically reject any `claude -p` / `spawn('claude', …)` invocation without `--output-format stream-json --verbose`. Allowlist (e.g. probe workers measuring envelopes, not progress) lives in lint config (`.gsd-t/lint-config.json` or inline marker comment), not tribal knowledge. Same enforcement model as M41 capture-lint. | m56-d5-stream-json-universality-lint | TBD | planned |
| REQ-M56-D5-03 | Lint hooked into `scripts/hooks/pre-commit-capture-lint` (or sibling pre-commit hook) so violations block commits. | m56-d5-stream-json-universality-lint | TBD | planned |
| REQ-M56-VERIFY | Full unit suite ≥ 2487 baseline + new tests for D1 (token-delta recording), D2 (5 new brief kinds), D3 (5 wire-in marker assertions), D4 (2 wire-in marker assertions), D5 (3 gap closures + lint logic + allowlist + pre-commit hook integration). All green. SC1-SC7 measured + recorded. | m56-d6-verify | TBD | planned |

## M57 CI-Parity Verify Gate (complete - v3.27.10)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M57-D1-01 | `bin/gsd-t-build-coverage.cjs::checkBuildCoverage({projectDir, baseRef, headRef})` enumerates new top-level paths added in the milestone commit range; verifies each is referenced by a `COPY`/`ADD` in Dockerfile, an artifact/copy step in cloudbuild.yaml, or a path in .github/workflows/*.yml. Detection is structural (parse source-arg position-by-position), never substring. Returns `{ok, missing[]}`. | m57-d1-build-coverage | T1-T5 | complete |
| REQ-M57-D1-02 | `gsd-t build-coverage` CLI subcommand and `GLOBAL_BIN_TOOLS` propagation. Failure returns exit 4. `cli-build-coverage-contract.md` v2.0.0 STABLE. | m57-d1-build-coverage | T2 | complete |
| REQ-M57-D2-01 | `bin/gsd-t-ci-parity.cjs` auto-detects project CI config (cloudbuild.yaml args-positional → .github/workflows run-positional via block-scalar-aware YAML walker → Dockerfile RUN lines → fallback package.json scripts); reproduces the real CI build locally with build caches cleared; auto-runs `docker build` when a Dockerfile is present; `clearBuildCaches` routes every config-derived delete through the containment predicate `resolved.startsWith(root+path.sep) && resolved!==root` (refuses outside-AND-equal-to projectRoot). | m57-d2-ci-parity | T1-T5 | complete |
| REQ-M57-D2-02 | Both `gsd-t build-coverage` and `gsd-t ci-parity` wired into `commands/gsd-t-verify.md` Step 2.6 as FAIL-blocking gates (failure = verify FAIL, blocks complete-milestone, never warning-only). | m57-wire-in | T6 | complete |
| REQ-M57-VERIFY | 7 frozen falsification-corpus variants flagged; containment predicate holds; suite 2587 pass / 0 fail. Origin: TimeTracking v1.10.12 post-mortem (verify reported VERIFIED+tagged while Cloud Build failed - new hooks/ dir absent from Dockerfile COPY + noImplicitAny passed warm-cache local tsc). | both | T7 | complete |

## M58 Test Data Cleanup Gate (complete - v3.28.10)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M58-D1-01 | `bin/gsd-t-test-data-ledger.cjs` ships `{appendInsert, listInserts, purgeRunInserts, registerAdapter}` against an append-only JSONL ledger at `.gsd-t/test-data-ledger.jsonl`. 3 built-in adapters under `bin/gsd-t-test-data-adapters/`: `localStorage-key-prefix`, `file-json-array` (atomic write-temp+rename), `sqlite-table-where` (parameterized DELETE with tagged-prefix LIKE guard). Each adapter refuses to delete a record whose id does not start with the ledger row's `taggedPrefix` (defense in depth). CLI `gsd-t test-data --list|--purge --run <id>` (exit 0/4/64). | m58-d1-test-data-ledger | T1-T4 | complete |
| REQ-M58-D2-01 | `templates/test-helpers/test-data-fixture.ts` ships the Playwright `withTestData()` fixture composing `{PREFIX}_{runId}_{counter}` IDs, reads `GSD_T_VERIFY_RUN_ID`, opt-in `purgePerTest`. Contract: `test-data-tagging-contract.md` v1.0.0 STABLE. | m58-d2-verify-cleanup | T1-T2 | complete |
| REQ-M58-D2-02 | `commands/gsd-t-verify.md` new Step 4.5 runs `gsd-t test-data --purge --run "$GSD_T_VERIFY_RUN_ID"` after E2E + before VERDICT. Adapter errors cause verify to FAIL (block-promotion semantics). Verify report gains `Test Data Cleanup` line. | m58-d2-verify-cleanup | T3 | complete |
| REQ-M58-VERIFY | 7/7 SCs PASS. 2649/2649 unit tests (baseline 2587, zero regressions). Red Team 6/6 attacks defended (untagged-id reject, tag-prefix tamper reject, unknown-adapter structured error, SQL injection reject, no stray writes, bad-return-value caught). Contracts: `test-data-ledger-contract.md` + `test-data-tagging-contract.md` v1.0.0 STABLE. | both | T5 | complete |

## M59 Timestamp Precision (complete - v3.29.10)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M59-01 | `bin/gsd-t-time-format.cjs` exports `localIsoWithOffset()` returning local-offset ISO string (`YYYY-MM-DDTHH:MM:SS+-HH:MM`) for use in archive-meta.json::completedAt. Never uses `new Date().toISOString()` (UTC Z) for local-time fields. | m59-time-format | T1 | complete |
| REQ-M59-02 | `## Date:` frontmatter in progress.md and Completed Milestones table "Completed" cell and Session Log "Date" cell MUST be written as `YYYY-MM-DD HH:MM TZ` from v3.29.10 onward. Pre-existing date-only rows stay unchanged (readers accept both formats). | m59-time-format | T2 | complete |
| REQ-M59-03 | `scripts/gsd-t-date-guard.js` PreToolUse hook validates timestamps in Write/Edit calls (decision-log entries, filename timestamps, banners, labeled stamps, progress.md table cells) within +-5 minutes of the live system clock. Fails open on internal error. Ignores timestamps that appear in BOTH old_string and new_string (pre-existing context). | m59-time-format | T3 | complete |

## M61 Platform Reconciliation - Native-First GSD-T (complete - v4.0.10)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M61-D1-01 | Retire context-meter/runway machinery obsoleted by native 1M context window: `token-budget.cjs`, `context-meter-config.cjs`, `context-budget-audit.cjs`, `runway-estimator.cjs`, `model-windows.cjs`, context-meter PostToolUse hook, `.context-meter-state.json` plumbing. ~4,133 LOC retired. Stub: `gsd-t-calibration-hook.js` uses `SAFE_DEFAULT_WINDOW = 1_000_000` inline literal. | m61-d1-retire-context-runway | T1-T5 | complete |
| REQ-M61-D2-01 | Retire the cross-session relay supervisor replaced by native background Workflows + `/loop`: `gsd-t-unattended.cjs`, `-safety.cjs`, `-platform.cjs`, `-heartbeat.cjs`, `supervisor-pid-fingerprint.cjs`, `handoff-lock.cjs`, `headless-auto-spawn.cjs`, `check-headless-sessions.js`, `unattended-watch-format.cjs`, `gsd-t-worker-dispatch.cjs`, `gsd-t-orchestrator-recover.cjs`, the 3 `gsd-t-unattended*` commands. ~8,800 LOC retired. | m61-d2-retire-unattended-relay | T1-T5 | complete |
| REQ-M61-D3-01 | Retire token-capture/attribution loop: `gsd-t-token-capture.cjs`, `-token-dashboard`, `-backfill`, `-regenerate-log`, `-report-tokens`, `-tool-attribution`, `-tool-cost`, `-in-session-usage`, `-economics`, `metrics-collector`, `gsd-t-capture-lint.cjs`. ~8,840 LOC retired. Stubs: `parallel-cli` captureSpawn pass-through; `parallel.cjs` estimateTaskFootprint zero-footprint. `metrics-collector.js` KEPT (167 LOC, rule-engine consumer). | m61-d3-retire-token-telemetry | T1-T5 | complete |
| REQ-M61-D4-01 | Retire the custom SSE viewer/dashboard replaced by native `/workflows` + Agent View: `live-activity-report.cjs`, stream-feed cluster, `scripts/gsd-t-dashboard-server.js`, viewer HTML, conversation-capture hooks. ~11,621 LOC retired. KEPT: `scripts/gsd-t-design-review-server.js` (standalone). | m61-d4-retire-viewer-dashboard | T1-T5 | complete |
| REQ-M61-D5-01 | Retire one-time milestone-proof artifacts with zero live references: m44-proof-measure, m46-iter-proof, m46-worker-proof, m55-substrate-proof, gsd-t-benchmark-orchestrator, gsd-t-parallel-probe, gsd-t-ratelimit-probe(+worker). ~3,632 LOC retired. | m61-d5-retire-proof-scratch | T1-T3 | complete |
| REQ-M61-D6-01 | Migrate orchestration core to native Workflow scripts. Ship `templates/workflows/_lib.js` with 8 helpers (runPreflight, generateBrief, proveFileDisjointness, runVerifyGate, loadProtocol, readDomainTasks, readScope, detectAndLoadStackRules placeholders). Ship `gsd-t-{execute,verify,wave,integrate,debug,quick,phase}.workflow.js`. Convert 14 command files from prose to thin `Workflow({scriptPath, args})` invokers. | m61-d6-migrate-orchestration | T1-T8 | complete |
| REQ-M61-D7-01 | KEEP and reframe validation as Workflow stages: Red Team / QA / Design-Verify run as `parallel() agent()` stages, de-duped against `/code-review ultra`. KEEP unchanged: `gsd-t-verify-gate(+judge)`, `gsd-t-ci-parity`, `gsd-t-build-coverage`, `gsd-t-test-data-ledger`, `journey-coverage(+cli)`, `cli-preflight`, `gsd-t-context-brief`, `playwright-bootstrap`/`ui-detection`, scan engine, `rule-engine`, `graph-*`, `archive-progress`, `global-sync-manager`. Ship `orthogonal-validation-contract.md` v1.0.0 STABLE. | m61-d7-keep-validation | T1-T5 | complete |
| REQ-M61-D8-01 | Doc-ripple and desktop-as-cockpit: rewrite `CLAUDE-global.md` + `CLAUDE-project.md` (drop retired-infra rules, rewrite 3 M55 sections to Workflow framing, add Orthogonal Validation Triad + Desktop as Cockpit + GSD-T Workflows sections). Ship retire-to-native map. No routine build/rebuild/debug/deliver action requires terminal hand-typing. | m61-d8-doc-ripple-cockpit | T1-T5 | complete |
| REQ-M61-VERIFY | bin/ 37,785 → 19,855 LOC (-17,930 LOC, 47% retired). 8 SCs: SC1 67% of <=12K target, SC2 deferred to M65, SC3 zero new regressions, SC4 deferred to M65, SC5 orthogonal triad shipped, SC6 retire-to-native map written, SC7 cockpit walkthrough (user-driven), SC8 4.8 audit GRUDGING-PASS equivalent. | all | - | complete |

**M61 Non-Functional Requirements:**
- bin/ LOC target: <=12,000 (37,785 baseline, 67% achieved at M61 completion)
- Zero new test regressions (41 expected failures from retired-convention tests do not count)
- Desktop as cockpit: all routine workflow operations executable from the Claude Code desktop app without terminal keystrokes

## M65 Orchestration-Shell Retirement (complete - v4.0.11)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M65-01 | Delete the obsolete M40/M44 orchestration shell the M61 Workflow scripts replaced: `bin/gsd-t-orchestrator.js` + `-worker/-queue/-config.cjs` + `spawn-plan-{writer,status-updater,derive}.cjs`. Inline `mapHeadlessExitCode` (5-code contract + M45 boundary-anchored regexes) into `gsd-t.js`, then delete `headless-exit-codes.cjs`. Remove `case "orchestrate"` dispatch, help line, `PROJECT_BIN_TOOLS` entries, and re-export plumbing. | m65-d1 | T1-T7 | complete |
| REQ-M65-02 | Delete dependent tests with their subjects (`m40-orchestrator-{config,queue,worker}`, `m44-d8-{spawn-plan-writer,spawn-plan-status-updater,post-commit-hook}`) + post-commit-spawn-plan hooks. KEEP `parallel-cli.cjs` (verify-gate Track-2), `parallel-cli-tee.cjs`, `gsd-t-parallel.cjs` (disjointness prover). | m65-d1 | T5-T6 | complete |
| REQ-M65-VERIFY | bin/ 22,051 → 20,271 LOC (-1,780). Suite 1361 pass / 23 fail (all M61 carryover) / 3 skip. Zero M65-subject failures. `gsd-t parallel --dry-run` KEEP-canary exit 0. | m65-d1 | T7 | complete |

## M66 Scan Volume-Scaled Workflow Migration (complete - v4.0.13)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M66-01 | NEW `templates/workflows/gsd-t-scan.workflow.js` - volume-scaled native Workflow. Phase: preflight → volume-probe (haiku, derives per-area slice list scaling 1-3 slices tiny to 15-40 slices large) → pipeline(per-slice deep-finder "enumerate not sample" [sonnet] → single verify pass [sonnet]) → synthesis (opus, archive prior + dedup/merge/re-rank + continue TD numbering deterministically via `_parseMaxTd` + `fs.renameSync` collision-safe) → deterministic `bin/scan-*.js` render stage. Budget-aware slice depth. | m66-d1-scan-workflow-migration | T1-T5 | complete |
| REQ-M66-02 | REWRITE `commands/gsd-t-scan.md` as a thin `Workflow({scriptPath, args})` invoker. Strip all dead references to `autoSpawnHeadless()` and `headless-default-contract v2.0.0`. Synthesis writes the 5 `.gsd-t/scan/*.md` dimension files in the renderer's exact parsed formats before the render stage. Hollow-guard: if `filesScanned===0` after synthesis, halt and report incomplete scan. | m66-d1-scan-workflow-migration | T1-T2 | complete |
| REQ-M66-VERIFY | Red Team FAIL → GRUDGING-PASS over 2 fix cycles. Zero regressions (1267/0/4 throughout). Patch bump 4.0.12 → 4.0.13. Depth-validation confirmed comparable to 117-item Hilo reference. | m66-d1-scan-workflow-migration | T6 | complete |

## M67 Scan Deep Document Phase (complete - v4.0.14)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M67-01 | Add a deterministic `Document` phase between Synthesis and Render in `gsd-t-scan.workflow.js`. One agent PER DOCUMENT fans out in parallel from the same slices + verified findings, producing: `docs/{architecture,workflows,infrastructure,requirements}.md` + `README.md` (merge, Edit-not-Write on existing files) + the five `.gsd-t/scan/*.md` dimension files (architecture/security/quality/business-rules/contract-drift) in the renderer's parsed formats. | m67-d1-scan-document-stage | T1-T3 | complete |
| REQ-M67-02 | Before the Document phase fan-out, take a deterministic snapshot of all 5 living docs to `.gsd-t/scan/.doc-backup/` to prevent data loss if the fan-out is interrupted (Destructive Action Guard). The backup dir is gitignored. | m67-d1-scan-document-stage | T2 | complete |
| REQ-M67-03 | The HTML report grand-total row uses the format `| Grand Total | N files | LOC |` as a table row (not inline prose) so `bin/scan-data-collector.js::parseFilesAndLoc` can correctly parse `filesScanned` without double-counting per-directory subtotals. | m67-d1-scan-document-stage | T3 | complete |
| REQ-M67-VERIFY | Red Team FAIL (2 HIGH + 1 LOW) → GRUDGING-PASS after 1 fix cycle. Zero regressions (1267/0/4). Patch bump 4.0.13 → 4.0.14. | m67-d1-scan-document-stage | T4 | complete |

## M68 Update-All Retired-Tool Prune (complete - v4.0.15)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M68-01 | `bin/gsd-t.js` adds `DEPRECATED_BIN_STRAY_SIGNATURES` - a per-tool map of VERBATIM shipped-header sentinels (recovered from git history) for the 17 tools retired in M61/M65. `update-all` prunes matching stale `.cjs` files from registered project `~/.claude/bin/` dirs by exact-header match + per-file deletion logging. A user's same-named file is never silently deleted (no substring matching, no bare-name matching). | m68-d1 | T1-T3 | complete |
| REQ-M68-VERIFY | +5 regression tests. Suite 1267→1272 pass / 0 fail / 4 skip. 273 retired `.cjs` pruned across 21 registered projects. Patch bump 4.0.14 → 4.0.15. | m68-d1 | T4 | complete |

## M69 Workflow scriptPath Resolution (complete - v4.0.16)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M69-01 | New `gsd-t workflow-path <name>` CLI subcommand resolves the absolute path to a named workflow script from the CLI's own PKG_ROOT. Works from any CWD / global install / npx invocation. Avoids relative `templates/workflows/...` paths that only resolve from the GSD-T source repo. | m69-d1-workflow-path | T1-T2 | complete |
| REQ-M69-02 | All 13 workflow-backed command files instruct resolving the scriptPath via `gsd-t workflow-path <name>` before the Workflow call. No command file hardcodes a relative or absolute path to the workflow scripts. | m69-d1-workflow-path | T3 | complete |
| REQ-M69-VERIFY | +6 tests (CWD-independence, aliases, all-8 workflows, exit 4/64). Suite 1272→1278 pass / 0 fail / 4 skip. Patch bump 4.0.15 → 4.0.16. | m69-d1-workflow-path | T4 | complete |

## M70 Workflow Invocation Guard (complete - v4.0.17)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M70-01 | `commands/gsd-t-scan.md` must lead with a strong imperative guard: agent's ONLY job is resolve-path + call the Workflow tool. Prose describing workflow internals must be reframed as "background context, NOT a to-do list". Hand-driving the fan-out is explicitly a FAILURE mode. | m70-d1 | T1 | complete |
| REQ-M70-02 | Equivalent (shorter) guards added to `commands/gsd-t-{execute,verify,wave,integrate,debug}.md` preventing agents from hand-driving these workflows instead of invoking the Workflow tool. The `/gsd` smart router prompt clarified to distinguish "invoke the tool" from "do the work yourself". | m70-d1 | T2-T3 | complete |
| REQ-M70-VERIFY | +7 regression tests asserting the guard text appears near the top of every workflow-backed command file. Suite 1278→1285 pass / 0 fail / 4 skip. Patch bump 4.0.16 → 4.0.17. | m70-d1 | T4 | complete |

## M71 Runtime-Native Scan Workflow (complete - v4.0.18)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M71-01 | `gsd-t-scan.workflow.js` must run correctly in the native Workflow sandbox which does NOT provide `require`, `module`, `fs`, `path`, `child_process`, `process`, or `spawnSync`. The orchestrator does ZERO I/O; all file reads/writes/git operations happen inside `agent()` subagents that have Bash/Read/Write tools. `args` is received as a JSON STRING and must be parsed with `JSON.parse()`. | m71-d1 | T1-T2 | complete |
| REQ-M71-02 | `computeSliceCap` provides a deterministic volume-derived backstop preventing runaway fan-out: tiny repos cap at 3 slices, Hilo-scale at ~27, huge repos at 50. Slices are redefined as cohesive sub-domains (not per-file). HTML render stage removed from the workflow (data-loss risk - it overwrote the package's own report). | m71-d1 | T3-T4 | complete |
| REQ-M71-03 | Enforcement: `test/m71-workflow-runtime-native-lint.test.js` - a lint test asserting that workflow files in the `RUNTIME_NATIVE` list contain no `require(`, `module.exports`, `child_process`, `spawnSync`, `execSync`, `execFileSync`, `process.execPath`, or `fs.*` calls. `RUNTIME_NATIVE` starts with `['gsd-t-scan.workflow.js']` and grows as additional workflows are migrated. | m71-d1 | T5 | complete |
| REQ-M71-VERIFY | +2 tests (forbidden-globals lint, cap calibration). Acceptance: real sandbox run `wf_da75f310` - status complete, 3 slices (cap held), 22 findings (all planted caught), 11 docs + 5 dimension files + plain-english in correct target. Patch bump 4.0.17 → 4.0.18. | m71-d1 | T6 | complete |

## M72 Scan Dropped-Slice Recovery + Coverage Honesty (complete - v4.0.19)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M72-01 | Each deep-finder slice is retried once on failure (`runFinder` retry). A still-failed slice is flagged `failed: true` in the result - never conflated with a genuinely-empty (clean) scan. Dropped slices are excluded from findings counts. | m72-d1 | T1-T2 | complete |
| REQ-M72-02 | Deterministic coverage accounting: `failedSlices`, `slicesSucceeded`, `coverageComplete` fields always present. When `failedSlices > 0`, synthesis MUST write a "WARNING: PARTIAL COVERAGE" banner (deterministic, not relying on agent interpretation). Return status downgrades to `complete-partial-coverage`. | m72-d1 | T3 | complete |
| REQ-M72-03 | Synthesis robustness: incremental section-by-section register write (avoids ~9-minute single-Write stall on large registers). Truncation cap increased from 200KB to 500KB. Resume re-scans only failed slices; cached successful slices are reused. | m72-d1 | T4 | complete |
| REQ-M72-VERIFY | +4 tests (m72-coverage-accounting). Coverage logic verified by real sandbox diagnostic (failedSlices detected, status downgraded). Patch bump 4.0.18 → 4.0.19. | m72-d1 | T5 | complete |

## M73 Scan Concurrency Throttle (complete - v4.0.20)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M73-01 | A shared 10-slot global counting semaphore (`makeSemaphore`) gates every finder + verifier agent. All slices and findings still fan out via `parallel()` but the gate caps total in-flight at 10 agents, preventing the rate-limit self-infliction caused by ~58 concurrent Sonnet agents. The lone Opus synthesis agent runs after, ungated. | m73-d1 | T1-T2 | complete |
| REQ-M73-VERIFY | Verified by 2 real sandbox diagnostics: 30-agent and 56-agent probes both measured peakConcurrency=10, never exceeded. Patch bump 4.0.19 → 4.0.20. | m73-d1 | T3 | complete |

## M74 Adaptive Rate-Limit Throttle (complete - v4.0.21)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M74-01 | `makeAdaptiveSemaphore` - a shrinkable/recoverable semaphore wrapping `gatedAgent`. On rate-limit error (detected by: "temporarily limiting requests" / 429 / overloaded / capacity), lowers the concurrency ceiling (10→9→8... floor MIN_CONCURRENT=4), backs off 2s/4s/6s (real setTimeout, not assumed), and RETRIES the same agent (<=4 attempts). Recovers +1 toward initial ceiling every 8 clean completions. Non-rate-limit errors bubble up un-retried. | m74-d1 | T1-T3 | complete |
| REQ-M74-VERIFY | +5 unit tests (m74-adaptive-throttle). Verified by 3 real sandbox diagnostics: setTimeout resolves verified, adaptive gate lowered 10→5 under 5 injected rate limits completing all 12 items with 0 errors, peak-10 cap holds. Patch bump 4.0.20 → 4.0.21. | m74-d1 | T4 | complete |

## M75 Deterministic Chunked Register Write (complete - v4.0.22)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M75-01 | Separate judgment from writing: bounded dedup agent (small input) → orchestrator deterministically merges/sorts/numbers/formats the register string (no fs, pure string-building) → `fmtChunks` splits into <=30KB chunks that never split a finding item → sequence of bounded write-agents (chunk 0 = Write, remaining chunks = Bash heredoc append). Prevents single-Write truncation on registers exceeding ~165KB. | m75-d1 | T1-T3 | complete |
| REQ-M75-VERIFY | +4 tests (m75-chunked-register). Verified by real sandbox diagnostics: single-Write truncated to 161/322 items (the bug); chunked write produced all 322 intact with no gaps/dups/truncation across 12 chunks. Patch bump 4.0.21 → 4.0.22. | m75-d1 | T4 | complete |

## M76 ASCII-Clean Register Output (complete - v4.0.24)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M76-01 | `ascii()` sanitizer in `fmtChunks` normalizes non-ASCII punctuation in all user-supplied fields: em-dash and en-dash → plain hyphen, smart/curly quotes → straight ASCII quotes, ellipsis character → `...`. Severity color bullets (🔴🟠🟡🟢) are explicitly KEPT (they render correctly and add value). Doc-phase agents receive "ASCII ONLY for dashes/quotes/ellipsis - keep severity color bullets" instruction. | m76-d1 | T1-T2 | complete |
| REQ-M76-VERIFY | +5 tests (m76-ascii-clean-register incl. structural guard on fmtChunks literals, bullets-kept assertion, dashes-normalized assertion). Patch bump 4.0.22 → 4.0.24 (v4.0.23 over-corrected by stripping emoji, reverted in same release). | m76-d1 | T3 | complete |

## M77 HTML Report Reads Deep-Scan Table Format (complete - v4.0.25)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M77-01 | `bin/scan-data-collector.js::parseDebtSummary` reads BOTH formats: the legacy prose format ("Critical items: N") AND the deep-scan severity table format (markdown table with severity and count columns). The HTML report tech-debt summary section accurately reflects deep-scan findings. | m77-d1 | T1-T2 | complete |
| REQ-M77-VERIFY | +4 tests (m77-renderer-table-summary). Patch bump 4.0.24 → 4.0.25. | m77-d1 | T3 | complete |

## M78 Plain-English Grouped + Batched (complete - v4.0.26)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M78-01 | The `techdebt_in_plain_english.md` scan output document groups findings by severity with section headers `## 🔴 Critical`, `## 🟠 High`, `## 🟡 Medium`, `## 🟢 Low`. Severity grouping is keyed by authoritative severity from the TD record (not parsed from agent phrasing). Empty severity levels are omitted. | m78-d1 | T1-T2 | complete |
| REQ-M78-02 | The Plain-English phase uses a dedicated bounded gated generator fan-out (separate from the main document targets) to handle 300+ entry registers without stalling. Deterministic assembly: severity-sorted findings batched → `## {severity}` section headers → chunk-written by the same M75 chunked-write pattern. | m78-d1 | T3 | complete |
| REQ-M78-VERIFY | +3 tests (grouped+complete+ordered, no mid-item split, empty-severity omission). Assembly proven in sandbox diagnostic (322 entries, all grouped correctly). Patch bump 4.0.25 → 4.0.26. | m78-d1 | T4 | complete |

## M79 Scan-Report Diagram Quality (complete - v4.0.27)

| REQ-ID | Requirement Summary | Domain | Tasks | Status |
|--------|---------------------|--------|-------|--------|
| REQ-M79-01 | `bin/scan-data-collector.js` populates `services`, `layers`, `endpoints`, and `states` from the scan's own document outputs (docs/architecture.md for services/layers/endpoints, docs/workflows.md for state transition chains). Diagram generators consume real codebase data, not hardcoded boilerplate. | m79-d1 | T1-T2 | complete |
| REQ-M79-02 | `genSystemArchitecture` draws up to 12 real domains from scan data with rounded classDefs. All 5 diagrams rendered with shared `MERMAID_CONFIG` (dark base theme + rounded corners + node padding/spacing) applied via `mmdc -c`, plus `-b transparent`. The Database Schema diagram is suppressed by default (`SUPPRESSED_TYPES`, opt-in via `includeSchemaDiagram` option) because Drizzle schema parsing produces inaccurate results on large repos. | m79-d1 | T3 | complete |
| REQ-M79-03 | `genSequence` uses `"validate and sanitize"` (unquoted `&` broke the Mermaid sequence parser). `scan.test.js` and `verify-gates.js` reflect the 5-diagrams-by-default contract (schema diagram excluded unless opted-in). | m79-d1 | T4 | complete |
| REQ-M79-VERIFY | +1 regression test (m79-diagram-quality). Suite 1325/1325 pass. Hilo report regenerated: 5/5 diagrams render, 35 real services, rounded corners present, schema section gone, no placeholders. Patch bump 4.0.26 → 4.0.27. | m79-d1 | T5 | complete |

## Updated Functional Requirements (scan findings - v4.0.27)

The deep scan identified functional deficiencies not captured in previous requirements. These are recorded here for tracking:

| REQ-ID | Requirement | Priority | Status | Finding |
|--------|-------------|----------|--------|---------|
| REQ-063 | Context Meter PostToolUse hook - count_tokens API call, state file, fail-open | P1 | SUPERSEDED (M61 retired) | M61 retired context-meter; 1M native window makes this obsolete |
| REQ-064 | Context Meter config schema | P1 | SUPERSEDED (M61 retired) | M61 retired context-meter; template ships with legacy 200K modelWindowSize |
| REQ-SCAN-01 | `model-selector.js` must assign `plan` → `opus` (not sonnet); add rules for `impact` (opus), `complete-milestone` (opus), `scan`, `backlog-promote`. Both `bin/model-selector.js` and `.gsd-t/contracts/model-selection-contract.md` must be updated atomically per the Schema Freeze Policy. | P2 | open | Scan finding: model-selection-contract.md vs model-selector.js diverge - `plan` gets sonnet instead of opus |
| REQ-SCAN-02 | Stack Rules Engine must inject stack rules into Workflow agent() prompts. Add `detectAndLoadStackRules(projectDir)` to `templates/workflows/_lib.js` and thread it into every `agent()` prompt in the Workflow scripts. | P2 | open | Scan finding: Stack rules silently dropped from all post-M61 execute/quick/debug/wave/integrate runs |
| REQ-SCAN-03 | `parseArgv` in `bin/gsd-t-parallel.cjs` must accumulate repeated `--domain` flags into an array (not last-wins overwrite). `proveFileDisjointness` in `_lib.js` currently passes multiple `--domain` args that are silently discarded. | P1 | open | Scan finding: Multi-domain disjointness gate checks only the last domain - primary safety invariant broken |
| REQ-SCAN-04 | `_shapeTrack2` in `bin/gsd-t-verify-gate.cjs` must propagate the envelope-level `ok` flag: `track2Ok = !!envelope.ok && workers.every(...)`. Empty workers array (`[].every()` vacuously true) must not produce a false-pass when the parallel substrate threw or returned no results. | P1 | open | Scan finding: verify gate false-passes when runParallel throws or returns empty results |
| REQ-SCAN-05 | `scripts/gsd-t-watch-state.js` must validate that the constructed `filePath` stays within the `.gsd-t/.watch-state/` directory before calling `_atomicWrite`. Agent-id must be validated against an allowlist regex (alphanumeric, hyphens, underscores only). | P1 | open | Scan finding: agentId path traversal via --agent-id CLI arg or GSD_T_AGENT_ID env var |
| REQ-SCAN-06 | `bin/scan-schema-parsers.js::parseDrizzle` must scope `colRe` to the matched table block, not the full file content. Each `pgTable`/`mysqlTable`/`sqliteTable` call should be parsed in isolation to prevent cross-table column attribution. | P1 | open | Scan finding: parseDrizzle attributes all columns from all tables to every table |
| REQ-SCAN-07 | `bin/gsd-t-verify-gate.cjs::_detectDefaultTrack2` must include `playwright.config.mjs` in the Playwright config detection check alongside `.ts`, `.js`, and `.cjs` variants. | P2 | open | Scan finding: ESM playwright configs (playwright.config.mjs) skip E2E in Track 2 |
| REQ-SCAN-08 | `scripts/gsd-t-update-check.js::fetchLatestVersion` has a syntax error in the inline node -e script (`r.on('data',(c)=>d+=c;` missing closing `)`)- the entire auto-update from SessionStart is broken. Fix: `r.on('data',(c)=>{d+=c});`. | P1 | open | Scan finding: SessionStart auto-update hook always returns null due to syntax error |
| REQ-SCAN-09 | `scripts/gsd-t-token-aggregator.js::updateTokenLog` column indices must match the actual 11-column token-log.md schema: `parts[10]` for task, `parts[7]` for tokens. Current hardcoded indices (parts[11], parts[8]) are based on a deprecated 12-column format. | P2 | open | Scan finding: updateTokenLog silently no-ops on every call due to column index mismatch |
| REQ-SCAN-10 | `scripts/gsd-t-token-aggregator.js::writeTokenUsageJsonl` in `runTail()` must overwrite (not append) the JSONL file with the current snapshot. Current append pattern causes unbounded growth with duplicate entries on every group-count change. | P2 | open | Scan finding: tail mode unbounded JSONL growth via unconditional append |
| REQ-SCAN-11 | `bin/gsd-t-context-brief-kinds/verify.cjs` regex must replace `\Z` (not a valid JS regex escape - treated as literal 'Z') with a proper end-of-string pattern. Currently the Falsifiable Success Criteria section is always empty when it appears last in the charter file (the common case). | P2 | open | Scan finding: verify.cjs \Z in regex - success criteria extraction fails at EOF |
| REQ-SCAN-12 | `bin/parallel-cli.cjs::_killChild` must return the SIGKILL timer handle and the call sites must store it so `clearTimeout(killTimer)` in the close/exit handlers correctly cancels the pending SIGKILL when the child exits cleanly after SIGTERM. | P2 | open | Scan finding: SIGKILL timer leaks - never cancelled when child exits cleanly after SIGTERM |
| REQ-SCAN-13 | `contracts-stable.cjs` regex must match the standard ATX heading format `## Status: ACTIVE` in addition to bare `Status: ACTIVE`. The current regex (`^\s*Status\s*:`) does not match lines starting with `##`. | P2 | open | Scan finding: contracts-stable preflight check never matches real progress.md heading format |
| REQ-SCAN-14 | `bin/gsd-t-verify-gate.cjs` synthesis verdict must have a programmatic post-synthesis guard: if Red Team result has `verdict: 'FAIL'`, downgrade `overallVerdict` to `'VERIFY-FAILED'` unconditionally, regardless of what the synthesis agent returned. | P1 | open | Scan finding: no programmatic enforcement of Red Team FAIL -> VERIFY-FAILED invariant |

## Updated Technical Requirements (v4.0.27)

| ID | Requirement | Metric | Status |
|----|-------------|--------|--------|
| TECH-014 | Native Workflow sandbox compliance: workflow scripts in `templates/workflows/` MUST NOT use `require`, `module`, `fs`, `path`, `child_process`, `process`, or `spawnSync`. All I/O must happen inside `agent()` subagents. Enforced by `test/m71-workflow-runtime-native-lint.test.js`. | 0 forbidden globals in RUNTIME_NATIVE list | partial (gsd-t-scan migrated; 6 other workflow scripts still violate) |
| TECH-015 | Workflow scriptPath must be resolved to absolute path via `gsd-t workflow-path <name>` before calling `Workflow({scriptPath})`. Relative paths only resolve from the GSD-T source repo, not consumer projects. | 100% of command files use workflow-path resolution | complete (M69) |
| TECH-016 | Zero external npm runtime dependencies for installer and CLI (inherited constraint from TECH-001). All bin/*.cjs modules use only Node.js built-ins. | 0 external deps | complete |
| TECH-017 | bin/ LOC target <=12,000 lines (from 37,785 at M61 baseline). Current: ~20,271 LOC at v4.0.11. | LOC measured by `wc -l` | in progress (M61 SC1: 67%) |

## Updated Non-Functional Requirements (v4.0.27)

| ID | Requirement | Metric | Status |
|----|-------------|--------|--------|
| NFR-010 | Scan register write handles 300+ findings without truncation. Uses chunked-write pattern (<=30KB per chunk, Write first chunk, Bash heredoc append subsequent chunks). No single-Write operation on registers exceeding 165KB. | 322/322 items intact on Hilo register | complete (M75) |
| NFR-011 | Scan concurrent agent fan-out capped at 10 via global counting semaphore. Rate-limit errors trigger adaptive semaphore reduction (floor MIN_CONCURRENT=4) with retry (<=4 attempts) and gradual recovery. | 0 empty registers from rate-limit self-infliction | complete (M73, M74) |
| NFR-012 | Deep scan slice count is volume-derived and deterministic (computeSliceCap): tiny repo=3, Hilo-scale=~27, huge=50. Prevents runaway fan-out on large codebases. | cap verified by lint test | complete (M71) |
| NFR-013 | Scan HTML report renders all 5 diagram types (system architecture, application architecture, workflow, data flow, sequence) from real codebase data. Database schema diagram suppressed by default to prevent inaccurate output from imprecise Drizzle parsing. | 5/5 diagrams render from real data | complete (M79) |
| NFR-014 | Living-doc updates from scan are non-destructive: Edit-not-Write on existing files. A deterministic snapshot of all 5 living docs is taken to `.gsd-t/scan/.doc-backup/` before the Document-phase fan-out. | 0 data-loss incidents | complete (M67) |

## Test Coverage (updated v4.0.27)

| Requirement / Milestone | Test File | Tests | Status |
|-------------------------|-----------|-------|--------|
| REQ-M57-D1, REQ-M57-D2 | test/m57-d1-build-coverage.test.js, test/m57-d2-ci-parity.test.js | 37 | passing |
| REQ-M58-D1, REQ-M58-D2 | test/m58-d1-*.test.js, test/m58-d2-fixture-helper.test.js | 62 | passing |
| REQ-M59 | test/m59-time-format.test.js | 8 | passing |
| REQ-M69 | test/m69-workflow-path.test.js | 6 | passing |
| REQ-M70 | test/m70-workflow-invocation-guard.test.js | 7 | passing |
| REQ-M71 | test/m71-slice-cap-algorithm.test.js, test/m71-workflow-runtime-native-lint.test.js | 4 | passing |
| REQ-M72 | test/m72-coverage-accounting.test.js | 4 | passing |
| REQ-M73, REQ-M74 | test/m74-adaptive-throttle.test.js | 5 | passing |
| REQ-M75 | test/m75-chunked-register.test.js | 4 | passing |
| REQ-M76 | test/m76-ascii-clean-register.test.js | 5 | passing |
| REQ-M77 | test/m77-renderer-table-summary.test.js | 4 | passing |
| REQ-M78 | test/m78-plain-english-grouping.test.js | 3 | passing |
| REQ-M79 | test/m79-diagram-quality.test.js | 1 | passing |

**Total automated tests (v4.0.27)**: 1325 pass / 0 fail / 4 skip. Runner: `node --test` (zero dependencies). E2E: `playwright.config.ts` at project root, `e2e/` directory with journey, viewer, and live-journey specs.
