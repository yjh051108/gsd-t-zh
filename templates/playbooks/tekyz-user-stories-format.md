# Tekyz User-Stories / Dev-Handoff PRD Format

> The canonical format for a Tekyz **development-team handoff** document: discrete user
> stories with workflows, grouped acceptance criteria, per-story flow diagrams, and mapped
> test cases. Reverse-engineered from `Compass_Sample_PRD_2.docx` (the sample Tekyz uses to
> illustrate its requirements-documentation process). `/gsd-t-user-stories` emits THIS format.
>
> This is a REFERENCE for structure + exact wording conventions — not the content. The
> command fills it from the actual input source (scan / requirements / design / codebase).

---

## Document skeleton (in order)

```
FRONT MATTER
1. Application Flow Overview        (numbered end-to-end journey + app-flow chart)
2. User Stories — Detailed Requirements
     EP-NN: <Epic Name>            (epic grouping)
       Phase: <MVP | Phase 1 | ...>
       <PREFIX>-NNN — <Story Title>
         meta line
         Story:                    (As a … I want … so that …)
         Workflow:                 (numbered steps)
         Acceptance Criteria:      (grouped by sub-area, bulleted)
         Flow Diagram:             (rendered Mermaid PNG, embedded as <img>)
         Mapped Test Cases:        (table)
3. <Phase> vs <Phase> Scope Summary  (story→phase→epic table)
```

---

## FRONT MATTER (verbatim conventions)

```
**<PRODUCT NAME>**

<one-line product descriptor>

Product Requirements Document

**Prepared by Tekyz Inc.**

Version <X.Y> — <source-of-truth note, e.g. "Design file v2.x as source of truth">
```

If the doc is illustrative/sample, include the italic SAMPLE DOCUMENT disclaimer block.

---

## §1 — Application Flow Overview

A numbered list (1..N) naming each major step of the end-to-end user journey in plain
language (e.g. "First-Time User Launch: App opens directly into … onboarding"). Follow with:
- an **app-flow chart** — a single Mermaid flowchart of the whole journey, rendered to PNG
  and embedded (`![Application Flow](media/app-flow.png)`), matching the sample's companion chart.
- the italic note that a complete flow chart accompanies the document.

---

## §2 — User Stories (the core; repeat per story)

Group stories under **Epics**: `**EP-01: <Epic Name>**` then `**Phase: <phase>**`.

Each story, in EXACTLY this order:

**Story ID + title:** `**<PREFIX>-NNN — <Story Title>**`
- `<PREFIX>` is a per-project story-id prefix (Compass used `CMPS`). Derive from the product
  name (e.g. NiceNote → `NN`, Newman Avatar → `NAV`). Sequential, zero-padded to 3.

**Meta line** (italic, pipe-separated):
`*Phase: <phase> | Reqs: <R-… list> | Test Cases: <N>*`
- `Reqs:` cross-references source requirement ids (from a scan register's TD-N, a requirements
  doc's R-N/FR-N, or synthesized ids). `Test Cases:` = count of rows in the Mapped Test Cases table.

**Story:** one sentence, italic, strict template:
`*As a <role>, I want <capability>, so that <benefit>.*`

**Workflow:** numbered steps (1..N) describing the concrete interaction sequence — what the
user does and what the system does in response. Present tense, specific.

**Acceptance Criteria:** bulleted, **grouped by sub-area** with a bold sub-heading per group
(e.g. `**Talking State:**`, `**Error and Recovery:**`). Each bullet is a single testable
assertion (state changed / content shown / constraint met). Include error/edge/recovery groups.

**Flow Diagram:** a per-story Mermaid flowchart of THIS story's workflow, rendered to PNG and
embedded (`![Flow Diagram](media/<PREFIX>-NNN-flow.png)`) — matching the sample's per-story `<img>`.

**Mapped Test Cases:** a markdown table with columns **TC ID | Type | Test Title | Expected Result**.
- `TC ID`: `TC-NNN` sequential across the whole document.
- `Type`: one of **Positive | Negative | Edge**.
- Cover the happy path (Positive), failure modes (Negative), and boundaries (Edge). Every
  acceptance-criteria group should be represented by at least one test case.

### Heading placement + no orphans (MANDATORY)

- Every section label sits ABOVE its content, never below. `Flow Diagram:` precedes its image;
  `Mapped Test Cases:` precedes its table; `Workflow:` precedes its steps. A label below the
  block it introduces is a defect.
- A heading must NOT be orphaned at a page bottom with its content on the next page — it stays
  with at least the first line of its content (keep-with-next). In `.docx`, enforce with
  `keepNext` on heading paragraphs or an explicit page break before a heading that would strand.

---

## §3 — Scope Summary

A table mapping every story to its phase + epic, so a team sees MVP vs later-phase scope at a glance:

`| Story ID | Title | Phase | Epic |`

---

## Diagram pipeline (Mermaid → embedded image)

Per the user directive, diagrams are **authored as Mermaid but EMBEDDED as rendered images**
(like the sample's `<img>` flow charts) — not left as raw Mermaid text.

### Semantic coloring (MANDATORY — never flat single-color)

Every diagram uses **role-based coloring**, never mermaid's default flat purple. Put a
`classDef` block at the top of each flowchart and class each node by ROLE:

```
classDef start       fill:#fff,stroke:#333,color:#000;                            %% start/end terminal
classDef decision    fill:#fdebc8,stroke:#e8a33d,color:#7a4f00;                  %% decision diamond
classDef screen      fill:#ece9fb,stroke:#8b7fd6,color:#2d2160;                 %% screen / state
classDef action      fill:#d4f4dd,stroke:#4caf72,color:#0f5132;                %% success / go / action
classDef destructive fill:#fde2e2,stroke:#e06666,color:#7a1f1f;               %% end / delete / irreversible
classDef newfeat     fill:#e2f0fb,stroke:#5b9bd5,color:#1f4e79,stroke-dasharray:4 3; %% NEW / optional (dashed)
```

Green = go/success/action · Orange = decision · Red = destructive/irreversible · Blue(dashed)
= new/optional · Purple = screen/state · White = terminal. Decisions are diamonds `{...}`;
terminals are round `([...])`; label decision-branch edges (`-->|Yes|`).

### Fit-to-page by ASPECT-RATIO CONTAIN (MANDATORY — deterministic)

Compare aspect ratios FIRST, then clamp only the constraining dimension (standard "contain" fit —
no clipping, no distortion). Page = visible content box, default US Letter portrait ≈ 6.5in × 9in (W×H).

**RESERVE LABEL SPACE:** each diagram's `Flow Diagram:` label sits above it on the same page. If the
image is set to FULL page height, no room is left for the label and keep-with-next pushes the image to
the next page (the Newman bug). So use `avail_height = page_height − label_reserve` (label_reserve ≈
0.5in) as the height constraint, NOT full page_height. `avail_width = page_width`;
`page_AR = avail_width / avail_height`.

1. Render to PNG, then MEASURE its pixels `img_w × img_h` (`sips -g pixelWidth -g pixelHeight`);
   `img_AR = img_w / img_h`.
2. Compare shapes against the label-reserved box:
   - `img_AR > page_AR` (wider) → **set width = avail_width (= page_width)** (height scales, fits).
   - `img_AR < page_AR` (taller) → **set height = avail_height (= page_height − 0.5in, NOT full page)**
     (width scales) — this leaves room for the label above.
   - equal → set width = avail_width.
3. Embed with ONLY the clamped side set (`<img … width>` OR `height`, never both). Label + image fit
   on one page.

Direction (`LR` for long flows, `TD` for short) is chosen to bring `img_AR` closer to `page_AR`
BEFORE clamping (maximizes final on-page size) — but the ratio clamp is what guarantees the fit.
Never ship a diagram larger than the page.

### Render

1. Write each diagram's Mermaid source (classDef block + role classes + fit-appropriate
   direction) to `.gsd-t/user-stories/diagrams/<name>.mmd`.
2. Render to PNG: `mmdc -i <name>.mmd -o media/<name>.png --width 1600 --backgroundColor white
   --scale 2 --padding 20` (`@mermaid-js/mermaid-cli`; fall back to `npx @mermaid-js/mermaid-cli`).
   If `mmdc` is unavailable, HALT and tell the user to install it — do NOT silently ship raw
   Mermaid where an embedded image is expected (no-silent-degradation).
3. Embed the PNG in the markdown: `![Flow Diagram](media/<name>.png)`.
4. On `.docx` conversion, pandoc embeds these PNGs as real Word images — matching the sample.

Keep the `.mmd` source (version-controllable, editable) alongside the rendered PNG.

---

## Output

- Markdown deliverable → `share/<Repo>-user-stories.md` (GSD-T share convention), with a
  `media/` dir of rendered diagram PNGs beside it.
- Optional `.docx` (matching the handoff sample) via `pandoc share/<Repo>-user-stories.md
  -o share/<Repo>-user-stories.docx` — embeds the PNGs as Word images.
