# Tekyz Estimation + PRD Playbook

> Reusable procedure for producing a Tekyz client estimate (Google Sheet: T-Shirt
> Size + Team Mix) and a matching PRD deliverable, from **any structured work
> document** — a GSD-T tech-debt scan register, a new-feature or new-application
> requirements doc, or an existing PRD. Proven on the HILO Figma ATOS project
> (21 criticals → 32.73 eng-days → $13,090–$16,362). Apply to E-Learning and any
> other GSD-T client project.
>
> **This process is SUPERVISED and JUDGMENT-HEAVY.** The operator reviews the
> judgment phases (sizing, adjustments, PRD) and is the FINAL ARBITER of the
> Estimate Red Team (Phase 8). It does not run autonomously. Rate + sheet template
> + factors are parameterized (defaults are the Tekyz values below). See
> `commands/gsd-t-estimate.md` for the authoritative, current phase list.

Related memory: `tekyz-estimation-method`, `tekyz-familiarization-bump`,
`tekyz-client-prd-structure`, `tekyz-tech-debt-numbering-caution`,
`google-sheets-service-account-workaround`.

---

## Phase 0 — Inputs

1. A completed GSD-T scan (`.gsd-t/techdebt.md`) with findings by severity.
2. A copy of the Tekyz estimate template Google Sheet (tabs: **Overview**,
   **T-Shirt Size Estimate**, **Team Mix**, **Technology Stack**).
3. The ATOS contractor-handoff PRD template (sections 0–15).
4. Decide the scope: usually **all CRITICAL findings** = "close the critical gap."

---

## Phase 1 — Renumber for the client (if scan numbers start high)

GSD-T continues TD numbering across scans; a fresh/crashed-and-rerun scan can start
at e.g. TD-618. **For a new client project, renumber to TD-1** before sharing.

- Verify the register IDs are contiguous (`min..max`, no gaps) → clean offset.
- Remap **only** numbers in the register's range (range-bounded regex) so you don't
  touch `DC-n`, other projects' TDs, or another repo's numbering.
- Scope: register, plain-English, `scan/*.md`, `docs/*.md`, README, PRD, `share/*`,
  and the Google Sheet labels. **Leave archives / transcripts / heartbeats alone.**
- Second pass for non-`TD-` formats: bare `| 618 |`, chains `TD-2/623`, header text.
- Back up files first.

---

## Phase 2 — Size each finding (T-Shirt tab)

For each finding, write a row (cols A–G; leave H–L formulas alone):
`A` Module · `B` User Type · `C` Functionality (include the `(TD-n)`) ·
`D` Low-Level Requirement · `E` Phase (MVP) · `F` Web Portal size · `G` Backend/API size.

- Size **each column independently** (FE and BE). Sizes: XS .25, S .5, M 1, L 3, XL 5, XXL 7.
- Sheet computes: `Days = F+G`, `MFactor = Days×MF`, `Total = Days+MFactor`,
  `LOW$ = Total×8×$50`, `HIGH$ = LOW$×1.25`.
- **Cluster the work** to size fast: "add existing auth guard to routes" (XS–S,
  repeated pattern) vs "new backend surface" (M, +FE) vs "config/1-route" (XS).

### Familiarization bump (new-team projects)
Base sizes assume *familiar* devs. For a new team, bump SIZE in proportion to
complexity (NOT the MF — Analysis MF is for a Business Analyst):
- Trivial → no bump. Repeated-pattern guards → +0-1 tier. High-volume sweeps +
  new-surface → +1 tier. **Never cross the M→L cliff (3×) unless genuinely multi-day.**
- Optionally add a one-time "Codebase Onboarding & Downstream Analysis" Common line (L–XL).

### Tune the MF (per project)
`Total MF` = QA + PM + Analysis + Deployment + Buffer (default 0.7). Raise Buffer/QA
when confidence is low; raise **High Factor** above 1.25 for more unknowns.

---

## Phase 3 — Group by domain + blue headings (T-Shirt tab)

Reorder items into domains (A–G to match the PRD). Insert a **blue section-heading
row** before each group (merge A:L, white bold on blue). No subtotals (they complicate
formulas). After reordering: **widen the rollup SUMIF ranges** (`E19:En`) — writing
cells does NOT auto-expand hardcoded ranges; only `insertDimension` shifts them.

---

## Phase 4 — Team Mix cross-check

`Count` = fractional headcount per role (fixed team shape). Solve `Month (D)` so
`sum(Count) × (Month×20) = T-shirt total`. Write `Month` to D5:D12; sync the Resource
(J) column. **Check for hardcoded cells** that break the formula chain (restore `=E×B`,
`=J`). Verify both halves (F13, J13) equal the T-shirt total.

---

## Phase 5 — Writing to the Google Sheet (auth)

gcloud's `spreadsheets` OAuth scope is **blocked by Google** (user ADC unusable).
Use the **PERMANENT reusable service account** (see
`google-sheets-service-account-workaround` memory + `commands/gsd-t-estimate.md`
Step 5 for the authoritative runbook):
- **SA (share-target):** `gsd-t-sheets-writer@ai-estimator-415612.iam.gserviceaccount.com`
- **Project:** `ai-estimator-415612` · **Key:** `~/.claude/gsd-t-secrets/gsd-t-sheets-writer-key.json` (chmod 600).

Flow: operator pastes sheet URL → extract id → shares sheet with the SA email as
Editor (one-time per sheet — SA is permanent) → JWT (RS256 via openssl) → token →
Sheets v4 REST (`values PUT` / `:batchUpdate`; reads via `GET ...includeGridData`).
Gotchas: `X-Goog-User-Project` header for 403 quota; `urllib.parse.quote` every
range; `insertDimension` to shift hardcoded SUMIF ranges; full `spreadsheets` scope
(not `drive.file`); JWT `exp=now+3600`, mint fresh each run.
**NEVER delete/recreate the SA** — recreation breaks every existing sheet share.

---

## Phase 6 — The PRD deliverable

One document, **domain sub-sections (A–G) inside each numbered section** (0–15).

- **§0 Metadata** + top-of-doc **⚠️ Estimate Basis & Disclaimer** (estimates, not a
  quote; will change; no not-to-exceed / guarantee). Purge quote/fixed/binding language.
- **§3.0 FR↔TD crosswalk** (per-domain tables: Requirement · Finding · Fix).
- **§3.1 FR tables** — dedicated **Finding** column (never bury TD in prose).
- **§3.2 NFR** — **Applies to** column listing **every** TD each cross-cutting NFR touches.
- **§4 enforcement, §8 API, §10 estimate** — explicit `TD-n` refs (not bare numbers).
- **§10 total must equal the live sheet rollup** (verify against the cell; watch that
  Project Setup carries its MF). Point-in-time sync is fine; note it.
- **§15 sign-off** = "Approved to proceed (scope, not fixed cost)".
- Group tables by domain with a bold header per group (no repeating "Domain" column).
- Save to `share/<Repo-Name>-PRD-*.md` (repo-name-prefixed).

---

## Phase 7 — Deliver

All client-facing files in `share/` with the repo-name prefix. Confirm the three
estimate views agree: T-Shirt total = Team Mix total = PRD §10 total.
