# GSD-T: Estimate — Tekyz Client Estimate + PRD from any Work Document

You are turning a **structured work document** into a **Tekyz client estimate** (a Google Sheet with a T-Shirt-Size tab + a Team-Mix cross-check) and a matching **PRD deliverable**. The input can be a GSD-T tech-debt scan register, a **new-feature requirements doc**, a **new-application requirements doc**, an existing PRD, or any comparable spec. `$ARGUMENTS` may carry the input path + a scope override (e.g. `--severity high`, `--input docs/requirements.md`).

**Full proven procedure:** read `~/.claude/playbooks/tekyz-estimation-and-prd-playbook.md` if present, else the bundled copy `templates/playbooks/tekyz-estimation-and-prd-playbook.md` in the GSD-T package (produced on the HILO Figma ATOS project: 21 criticals → 32.73 eng-days → $13,090–$16,362). Supporting memories (in the originating project's memory dir): `tekyz-estimation-method`, `tekyz-familiarization-bump`, `tekyz-client-prd-structure`, `tekyz-tech-debt-numbering-caution`, `google-sheets-service-account-workaround`. This skill ENCODES those; read them for edge-case depth.

> **Client-billed work, not GSD-T build work.** This produces a paid client estimate — the "no cost estimates" rule (`feedback_no_human_hour_estimates`) governs GSD-T's OWN Max-funded build work, NOT client deliverables. Dollar figures here are correct and expected.

## Human-in-the-Loop (MANDATORY — this command is SUPERVISED, not auto)

This process is judgment-heavy. **You (the operator) are the final arbiter of every estimate.** The command does NOT run end-to-end autonomously.

- **Judgment phases PAUSE for review** before advancing: **Step 2 (sizing)**, **Step 2.5 (adjustments)**, **Step 6 (PRD)**, **Step 8 (Red Team)**. Present the output, wait for the user's `continue` or corrections.
- **Mechanical phases FLOW but SHOW their result**: Step 1 (numbering), Step 5 (sheet write), Step 7 (reconcile). Don't block on these, but display what happened so nothing is invisible.
- **Escape hatch:** if the user says e.g. "run through sizing and grouping, then stop," batch those phases and pause where they asked.

## Configuration (parameterized — defaults are Tekyz values)

Read these from `$ARGUMENTS` or `.gsd-t/estimate-config.json` if present; otherwise use the Tekyz defaults. **Always name the active values in the report** (no silent defaults). This config is **optional and NOT auto-created** (it's Tekyz-estimate-specific, not every-project state) — to override the defaults, copy the documented template `templates/estimate-config.json` (in the GSD-T package, or `~/.claude/templates/estimate-config.json`) to `.gsd-t/estimate-config.json` and edit. Every field is individually optional; an omitted field falls back to its Tekyz default.

| Param | Default (Tekyz) | Meaning |
|-------|-----------------|---------|
| `rate` | `$50/hr` | Blended hourly rate for the LOW figure. |
| `hoursPerDay` | `8` | Hours per person-day. |
| `sizeScale` | `XS 0.25 · S 0.5 · M 1 · L 3 · XL 5 · XXL 7` | T-shirt → person-days. |
| `totalMF` | `0.7` | Overhead multiplier = QA 0.3 + PM 0.1 + Analysis 0.05 + Deployment 0.05 + Buffer 0.2. |
| `highFactor` | `1.25` | HIGH = LOW × this. |
| `sheetTemplateId` | (blank) | Optional template to clone; normally blank — operator pastes the target sheet URL at Step 0. |
| `gcpProject` | `ai-estimator-415612` | GCP project hosting the permanent Sheets-writer SA. |
| `serviceAccountEmail` | `gsd-t-sheets-writer@ai-estimator-415612.iam.gserviceaccount.com` | **Permanent** SA — share each sheet with this as Editor. |
| `serviceAccountKeyPath` | `~/.claude/gsd-t-secrets/gsd-t-sheets-writer-key.json` | SA key (chmod 600, outside any repo). |

## Step 0: Inputs + Scope + Sheet

1. **ASK FOR THE GOOGLE SHEET URL FIRST.** The operator ALWAYS provides an existing sheet to edit — this command never creates the sheet. Prompt: *"Paste the Google Sheet URL for this estimate."* Extract the **sheet ID** = the segment between `/d/` and the next `/` in `https://docs.google.com/spreadsheets/d/<ID>/edit`. Confirm the ID back to the operator.
2. **Ensure the sheet is shared with the permanent estimate service account** (details in Step 5). The reusable SA email is **`gsd-t-sheets-writer@ai-estimator-415612.iam.gserviceaccount.com`**. Do a quick read-probe (Step 5's JWT→token→`GET spreadsheets/<id>`): if it returns `403`, the sheet isn't shared yet → prompt the operator to share it with that email as **Editor** ("Notify people" unchecked), wait for confirmation, re-probe. If the SA/key doesn't exist yet, Step 5 provisions it once.
3. **Resolve the input document** (from `$ARGUMENTS --input`, else default to `.gsd-t/techdebt.md`). If none found → "No input document found. Pass `--input <path>` or run `/gsd-t-scan` first." and stop.
4. **Classify the input** so the parser + line-item vocabulary match:
   - **Scan register** (`.gsd-t/techdebt.md`) → line-items are *findings* (`TD-n`), scoped by severity.
   - **Requirements doc / feature spec / app spec / PRD-in** → line-items are *requirements* (`FR-n` or the doc's own numbering).
5. **Scope** (from `$ARGUMENTS`): scan default = **all CRITICAL findings** ("close the critical gap"); `--severity high|medium|low|all` widens it. Requirements default = **all requirements** unless the user narrows. Confirm the scope + item count with the user before sizing.
6. Confirm the active config values above (rate/MF/highFactor — from `.gsd-t/estimate-config.json` or Tekyz defaults).
7. Decide whether this is a **new-team project** (triggers the familiarization adjustment, Step 2.5) — usually YES for a fresh client.

## Step 1: Numbering hygiene (MECHANICAL — show result)

Client-facing line-items must carry **sequential, rational numbering starting at 1**. Requirements docs often have NO numbers, or hierarchical numbers, or (rarely) a scan that crashed-and-reran starts high (e.g. TD-618, which looks bad — "why does #1 start at 618?"). (`tekyz-tech-debt-numbering-caution`.)

**Renumber ONLY when the numbering is absent, non-sequential, or doesn't start at 1.** If it is already sequential and rational, LEAVE IT.

- **Unnumbered input** → assign sequential ids (`FR-1, FR-2, …` or `TD-1, …`).
- **Hierarchical numbering** (`1`, `1.1`, `1.1.1` = requirement / sub / sub-sub) → **preserve the hierarchy**; renumber only to make each level sequential-and-rational (no gaps, starts at 1 within its parent). Never flatten a hierarchy.
- **Already-clean numbering** → no change.
- When you DO renumber, do it SAFELY (numbering-only, zero value changes):
  - Confirm the id range is contiguous first, so a blind offset aligns.
  - **Range-bounded regex** — remap ONLY numbers in the doc's actual range, so you never corrupt `DC-n`, another project's `TD-4`, or a different repo's numbering.
  - **Scope to CURRENT deliverables only:** the input doc, plain-English companion, `.gsd-t/scan/*.md`, `docs/*.md`, README, the PRD, `share/*`, and the Google Sheet labels. **Leave `.gsd-t/scan/archive/`, transcripts, heartbeats UNTOUCHED.**
  - **Second pass for non-prefixed formats:** bare `| 618 |` table cells, slashed chains (`TD-2/623`), header text. A first-pass `PREFIX-NNN` regex misses these.
  - **Back up files before the bulk edit.**
- A client that wants the original numbering keeps it — offer, don't force.

## Step 2: Size each line-item (T-Shirt Size tab) — JUDGMENT · PAUSE FOR REVIEW

For each in-scope item, build a row — cols **A** Module · **B** User Type · **C** Functionality (**include the `(TD-n)` / `(FR-n)`**) · **D** Low-Level Requirement · **E** Phase (MVP) · **F** Web Portal (frontend) size · **G** Backend/API size. **Leave H–L (formulas) alone.**

- **Size each column INDEPENDENTLY** (FE and BE each get their own letter; blank = 0). Sizes per `sizeScale`: **XS 0.25 · S 0.5 · M 1 · L 3 · XL 5 · XXL 7** person-days.
- The sheet computes: `Days = F+G` · `MFactor Days = Days × totalMF` · `Total Days = Days + MFactor` · `LOW $ = Total × hoursPerDay × rate` · `HIGH $ = LOW × highFactor`. **Ignore the Phase column.**
- **Cluster by fix-shape to size fast:** "add existing auth guard to N routes" (XS–S, repeated pattern) vs "new backend surface" (M, +FE) vs "config / single route" (XS). Size the cluster once, apply to its members.
- **Tune the MF per project:** raise Buffer/QA when confidence is low; raise `highFactor` above 1.25 for more unknowns.
- **PAUSE:** present the sized rows (or the clusters + representative sizes) and the running total. Wait for `continue` or corrections before Step 2.5.

## Step 2.5: Estimate Adjustments (familiarization + risk/unknowns) — JUDGMENT · PAUSE FOR REVIEW

Base sizes assume *familiar* devs on *well-understood* work. Adjust for the two things that make real work heavier than the naive size. Document each adjustment per-item so the client sees **why** an item is heavier. (`tekyz-familiarization-bump`.)

**(a) New-team familiarization** — ramp for a team new to the codebase. Bump each item's SIZE in proportion to its complexity — **NOT the MF** (the Analysis MF is for a Business Analyst, not dev ramp).
- Trivial config / single-route → **no bump**. Repeated-pattern guards, few routes → **+0–1 tier**. High-volume sweeps + new-surface builds → **+1 tier**.
- Optionally add a one-time **"Codebase Onboarding & Downstream Analysis"** Common line (sized L–XL) — document as optional, client can remove.

**(b) R&D / unknown-approach / spike risk** — an item needing research, an unproven approach, or an unknown integration gets an uplift for the uncertainty. Either bump its SIZE, or raise its per-item risk contribution (and consider raising `highFactor` for the whole estimate if unknowns dominate). Name the unknown explicitly ("requires spike: undocumented 3rd-party API").

**⚠️ The scale is NON-LINEAR. M→L is a 3× cliff (1 day → 3 days).** A blind one-tier bump across M→L doubles the total. **Never push an item across M→L unless it is genuinely multi-day.** Cap routine-work bumps at M.
- Reference calibration: HILO 21 criticals = $8,700 familiar → $11,730 new-team (+35%, bumps capped at M) → $13,090 incl Project Setup.
- **PAUSE:** present every adjustment (item, reason, before→after size, total delta). Wait for `continue` or corrections.

## Step 3: Group by domain + blue headings (T-Shirt tab)

Reorder items into domains (**A–G to match the PRD sections**). Insert a **blue section-heading row** before each group (merge A:L, white bold on blue). **No subtotals** (they complicate formulas).

- **After reordering, WIDEN the rollup SUMIF ranges** (e.g. `E19:En`). Writing cells does NOT auto-expand hardcoded ranges — only `insertDimension` shifts them. A missed widen silently under-counts the total.

## Step 4: Team Mix cross-check

`Count` = fractional headcount per role (e.g. Backend 0.75 = one BE dev at 75% over the window). `Days (E) = Month(D) × 20` · `Total Days = Days × Count`.

- **Solve `Month` (D5:D12)** so `sum(Count) × (Month×20) = the T-shirt total`. Sync the Resource (J) column.
- **Check for hardcoded cells** breaking the formula chain (restore `=E×B`, `=J` where a static number was pasted — the Testing row is a known offender).
- **Verify BOTH halves (F13, J13) equal the T-shirt total.**

## Step 5: Write to the Google Sheet (PERMANENT reusable service account) — MECHANICAL · show result

**gcloud's `spreadsheets` OAuth scope is blocked by Google** (browser shows "This app is blocked"; `gcloud auth print-access-token` is unusable for Sheets), so a **service account with a self-signed JWT** is the only working path (`google-sheets-service-account-workaround`). A **PERMANENT, reusable SA already exists** — do NOT create a throwaway per run.

**The permanent estimate SA (provisioned once, reused every run):**
- **Email (the sheet share-target):** `gsd-t-sheets-writer@ai-estimator-415612.iam.gserviceaccount.com`
- **GCP project:** `ai-estimator-415612` · **Sheets API:** enabled
- **Key file:** `~/.claude/gsd-t-secrets/gsd-t-sheets-writer-key.json` (chmod 600, outside any repo — never commit an SA key)

1. **Self-heal / provision-once (idempotent):** if the key file is missing, recreate the SA + mint a key before proceeding — this is the ONLY create path, and it runs at most once ever:
   ```bash
   PROJECT=ai-estimator-415612
   SA=gsd-t-sheets-writer@$PROJECT.iam.gserviceaccount.com
   KEY=~/.claude/gsd-t-secrets/gsd-t-sheets-writer-key.json
   gcloud services enable sheets.googleapis.com --project=$PROJECT
   gcloud iam service-accounts describe "$SA" --project=$PROJECT >/dev/null 2>&1 || \
     gcloud iam service-accounts create gsd-t-sheets-writer \
       --display-name="GSD-T Estimate Sheets Writer (permanent, reusable)" --project=$PROJECT
   # SA creation is eventually-consistent — poll describe before minting the key
   [ -f "$KEY" ] || { mkdir -p ~/.claude/gsd-t-secrets && chmod 700 ~/.claude/gsd-t-secrets && \
     gcloud iam service-accounts keys create "$KEY" --iam-account="$SA" --project=$PROJECT && chmod 600 "$KEY"; }
   ```
2. **Share check:** the SA has no access until the sheet is shared with it. If a read-probe (below) returns `403`, **prompt the operator to share the sheet with `gsd-t-sheets-writer@ai-estimator-415612.iam.gserviceaccount.com` as Editor** (uncheck "Notify people"), wait for confirmation, re-probe. Because the SA is permanent, this is a **one-time** share per sheet — no re-share churn.
3. **Auth = self-signed JWT** (pure stdlib + openssl, no client libraries): read the key file, sign an RS256 JWT (`openssl dgst -sha256 -sign`), scope `https://www.googleapis.com/auth/spreadsheets`, exchange at `oauth2.googleapis.com/token` (grant `urn:ietf:params:oauth:grant-type:jwt-bearer`) for a Bearer token. JWT `exp = now + 3600`; **mint fresh each run** (1h expiry).
4. **Write via Sheets v4 REST** with the Bearer token: `values/<range>/PUT?valueInputOption=USER_ENTERED` for cell values; `:batchUpdate` for inserts/formatting/merges. **Reads:** `GET spreadsheets/<id>?ranges=...&includeGridData=true` (used for the 403 share-probe too).
5. **Gotcha fixes (all proven on HILO):**
   - **403 quota-project** on the Sheets API → add header `X-Goog-User-Project: ai-estimator-415612`.
   - **URL-encode every range** (`urllib.parse.quote`) — spaces in tab names (e.g. `'T-Shirt Size Estimate'!A19`) break the URL.
   - **Hardcoded SUMIF/total ranges don't auto-expand** on a plain values-write → use `insertDimension` (which shifts ranges) when inserting rows (ties back to Step 3's WIDEN note).
   - **`drive.file` scope 404s on a pre-existing sheet** → must use the full `spreadsheets` scope.
6. **No cleanup / no delete.** The SA is PERMANENT and reused — never delete it, never delete the key. (Deleting + recreating an SA changes its internal id and silently breaks every existing sheet share even with an identical email → 403. Keeping it permanent is the whole point.)

## Step 6: Generate the PRD — JUDGMENT · PAUSE FOR REVIEW

**ONE document** (ATOS contractor-handoff template, sections 0–15) with **domain sub-sections (A–G) inside each numbered section** — not one PRD per item. (`tekyz-client-prd-structure`.)

- **§0 Metadata + top-of-doc ⚠️ Estimate Basis & Disclaimer** — planning estimates, NOT a quote/bid/fixed price; will change; no not-to-exceed; no delivery guarantee. **Purge all quote/fixed/guarantee/binding language.**
- **§3.0 requirement↔finding crosswalk** — per-domain tables (Requirement · Finding · Fix). `FR-xN` (domain-sequenced requirement id) and `TD-n` (permanent scan finding id) do NOT run in parallel — always crosswalk them. (For a pure requirements input with no scan, the "Finding" column becomes the source requirement id.)
- **§3.1 FR tables** — a **dedicated Finding/Source column** (never bury the id in trailing prose).
- **§3.2 NFR** — an **"Applies to" column listing EVERY id** each cross-cutting NFR touches.
- **§4 enforcement, §8 API, §10 estimate** — explicit id refs (not bare numbers).
- **§10 total MUST equal the live sheet rollup** — verify against the sheet's rollup cell, not memory. Watch that Project Setup carries its MF (M/M = 2 raw → 3.4 total, not 2.0). Point-in-time sync is fine; note it.
- **§15 sign-off = "Approved to proceed (scope, not fixed cost)".**
- Group tables **by domain with a bold header per group** (no repeating "Domain" column — reads as broken).
- **Save to `share/<Repo-Name>-PRD-*.md`** (repo-name prefix, matching `/gsd-t-scan`'s `share/` convention).
- **PAUSE:** present the PRD (or its outline + disclaimer + §10 total) for review before finalizing.

## Step 7: Verify — reconcile the three totals (MECHANICAL · show result)

**The three totals MUST agree:** T-Shirt Size total = Team Mix total (F13/J13) = PRD §10 total. If any differ, find the break (usually a hardcoded cell or an un-widened SUMIF range) and fix before advancing to the Red Team.

## Step 8: Estimate Red Team (adversarial) — JUDGMENT · PAUSE · YOU ARE THE ARBITER

An independent adversarial pass that challenges the estimate before it reaches the client — the estimate-time analogue of GSD-T's build Red Team. **Its job is to protect Tekyz from a money-losing under-estimate AND to keep the estimate competitive** (paired realism, per `feedback_red_team_realism_gate` — don't pad every item to XXL "to be safe").

**What it attacks:**
- **Under-sized items** — "this 'S' implies a DB migration + backfill → really M; +2 days."
- **Missing line-items** — work a requirement implies but nothing sized (migrations, tests, auth, error states, rollout).
- **Optimistic multipliers** — Buffer/QA too low for the stated confidence; `highFactor` too tight for the unknowns.
- **Adjustment gaps** — an R&D/unknown item (Step 2.5b) sized as if it were routine.
- **Cross-check integrity** — do the three totals ACTUALLY reconcile, or is a hardcoded cell hiding a break.
- **Assumption / scope gaps** — unstated assumptions that would blow up mid-project.

**Verdict:** `FAIL` (material under-estimate or missing scope found) / `GRUDGING-PASS` (exhaustive search, nothing material).

### The arbitration protocol (David is the final judge — NOT bot ping-pong)

When the Red Team returns `FAIL`, it does **NOT** loop back-and-forth with the skill until it grudgingly passes. It surfaces to **the operator**:

1. **Present each objection PLAINLY:** *what* shouldn't pass, *why*, and *the estimate impact* (which item, before→after size, dollar delta). One clear list, ranked by dollar impact.
2. **The operator decides, per objection:**
   - **Agree** → operator says `continue` → apply the fix.
   - **Disagree** → operator gives feedback → **the Red Team argues back.** The argument continues until **one side concedes** OR the operator ends it definitively.
3. **Definitive-decision override:** if the operator says anything conclusive — e.g. *"No more argument. I've decided on X,"* or any clearly final ruling — the Red Team **MUST grudgingly accept the operator's decision immediately, regardless of how many rounds have passed.** It **MAY document its unresolved objection** (in the PRD as a footnote or a `share/<Repo>-estimate-redteam-notes.md` file) **for later consideration** — but it does not re-litigate.
4. The Red Team **never self-satisfies into a pass** and **never overrides the operator.** It either persuades the operator or defers to them.

**PAUSE** at every objection — this phase is inherently interactive.

## Step 9: Deliver

All client-facing files land in `share/` with the repo-name prefix. Report: input type + scope + item count, the active config values (rate/MF/highFactor), the eng-days + LOW–HIGH dollar range, the sheet URL, the PRD path, the Red Team verdict, and any documented-but-overridden Red Team objections.

## Document Ripple

- `share/<Repo>-PRD-*.md` (new PRD deliverable) + the Google Sheet (external) + optional `share/<Repo>-estimate-redteam-notes.md` (overridden objections).
- If renumbering (Step 1) ran: the input + plain-English + `scan/*.md` + `docs/*` + README + `share/*` were remapped (archives untouched) — note it in the report so the numbering change is traceable.

## ▶ Next Up

Standalone command — no auto-successor. After delivering, the user shares the sheet + PRD with the client.
