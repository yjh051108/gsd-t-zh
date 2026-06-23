# Tasks: m86-d4-surfacing-and-doc-ripple

> Plan-grade Shape D. LOW-RISK additive consumer work, isolated so it never gates the
> risky core (D1) / sandbox-fragile (D2) / safety-critical (D3) domains. The behavioral
> surfacing tasks (banner/statusline/status — SC(f)) carry **Files** + **Acceptance
> criteria** + **Test**. The pure doc-ripple + version tasks are scaffolding (no
> observable behavior to trace) but are gated by the Document Ripple Completion Gate.
> D4 CONSUMES D1's resolver — it MUST NOT reimplement the profile→tier map or schema.

## Files Owned

- `scripts/gsd-t-auto-route.js`
- `scripts/gsd-t-statusline.js`
- `commands/gsd-t-status.md`
- `commands/gsd-t-help.md`
- `README.md`
- `GSD-T-README.md`
- `templates/CLAUDE-global.md`
- `CLAUDE.md`
- `package.json`
- `test/m86-surfacing.test.js`

---

### M86-D4-T1 — Banner surfacing (active profile, named — SC(f))
**Touches:** `scripts/gsd-t-auto-route.js`
**Files:** `scripts/gsd-t-auto-route.js`
**Test:** `test/m86-surfacing.test.js` (spawns the hook against a fixture project with/without `.gsd-t/model-profile.json`; asserts the banner names the profile, and the `[GSD-T NOW]` timestamp format is byte-unchanged)
**Depends on:** D1-T2 (the resolver/config-read surface).
**Contract refs:** `model-profile-config-contract.md` §Per-Project Config Schema; `feedback_no_silent_degradation.md`.

Resolve the active profile via D1's config-read/resolver and add it to the `[GSD-T ...]` banner
token line (NAMED; global-default named when config absent — e.g. `profile: premium (default)` —
SC(f)). Consume the resolver — do NOT re-hardcode the profile→tier map. Do NOT alter the
`[GSD-T NOW]` timestamp format (date-guard dependency).

**Hook resilience (pre-mortem r1 #7 MEDIUM):** this is the every-turn, every-project
UserPromptSubmit hook — the `[GSD-T NOW]` source the date guard depends on AND the auto-route
signal. The new resolver dependency MUST be fully guarded: resolver module/binary absent in a
consumer install (the `project_global_bin_propagation_gap` breakage class), resolver returning
`{ok:false}`, or spawn failure must NEVER throw, NEVER suppress the NOW line, NEVER kill
auto-routing. Render the profile as the named default or an explicit `profile: unknown` marker
and carry on.

**Acceptance criteria:**
- With `.gsd-t/model-profile.json` present → the banner names that profile; absent → it names the
  global default with a `(default)` marker (never blank, never an implicit unsurfaced fallback) —
  SC(f).
- The `[GSD-T NOW]` line format is byte-unchanged (date-guard intact).
- Resilience cases: (1) resolver module/binary ABSENT and (2) resolver ERRORS → hook exits 0,
  `[GSD-T NOW]` line byte-format intact, profile rendered as named default or explicit
  `profile: unknown` (never a crash, never a dropped banner).
- Verified by `node --test test/m86-surfacing.test.js` (present/absent fixtures + NOW-format
  assertion + the 2 resilience fixtures).

### M86-D4-T2 — Statusline surfacing (active profile, named)
**Touches:** `scripts/gsd-t-statusline.js`
**Files:** `scripts/gsd-t-statusline.js`
**Test:** `test/m86-surfacing.test.js` (runs the statusline against present/absent fixtures; asserts the profile is named)
**Depends on:** D1-T2.
**Contract refs:** `model-profile-config-contract.md` §Per-Project Config Schema; `feedback_no_silent_degradation.md`.

Show the active profile in the statusline (NAMED; consume D1's resolver, do not reimplement).
`scripts/gsd-t-statusline.js` is owned EXCLUSIVELY by D4 (the salvage variant that put it in D1
is rejected to keep surfacing a single blast radius). **Resilience (pre-mortem c2 #5): same
treatment as T1's hook** — the statusline runs on every render in every project; resolver
module/binary absent (propagation-gap class) or resolver error must never crash it.

**Acceptance criteria:**
- The statusline names the active profile (present → that profile; absent → named global default).
- Resilience cases: resolver absent AND resolver erroring → statusline exits 0 and renders
  (profile segment omitted or `profile: unknown`), never a crash — mirroring T1's two hook
  fixtures.
- Verified by `node --test test/m86-surfacing.test.js` (statusline present/absent + 2 resilience
  cases).

### M86-D4-T3 — status command rendering (active profile line)
**Touches:** `commands/gsd-t-status.md`
**Files:** `commands/gsd-t-status.md`
**Test:** doc-ripple gate (the rendering is described); the surfacing behavior itself is tested by T1/T2's `test/m86-surfacing.test.js`
**Depends on:** D1-T2.
**Contract refs:** `model-profile-config-contract.md` §Per-Project Config Schema.

Describe the new active-profile line in `gsd-t status` rendering (named choice, never an implicit
fallback — SC(f)).

**Acceptance criteria:**
- `commands/gsd-t-status.md` documents the active-profile line as a NAMED choice (SC(f) prose
  obligation surfaced to the user).
- Verified by the Document Ripple Completion Gate (status command describes the new line).

### M86-D4-T4 — help entry for `gsd-t model-profile`
**Touches:** `commands/gsd-t-help.md`
**Files:** `commands/gsd-t-help.md`
**Depends on:** D1-T3 (the dispatch the help documents).

Add the `gsd-t model-profile [standard|pro|premium]` / `set-stage <stage> <tier>` / `--json`
entry. (Doc scaffolding — no observable behavior to trace; gated by the Document Ripple gate.)

### M86-D4-T5 — README + GSD-T-README doc-ripple
**Touches:** `README.md`, `GSD-T-README.md`
**Files:** `README.md`, `GSD-T-README.md`
**Depends on:** D1 (the feature), D2 (the mechanism).

README: commands-table row for `model-profile` + a Profiles section (the 3-profile spend table,
per-stage override, per-project `.gsd-t/model-profile.json`, out-of-scope note re `/model`).
GSD-T-README: Profiles documentation. (Doc scaffolding — Document Ripple gate.)

### M86-D4-T6 — CLAUDE template + project doc-ripple (+ live mirror FLAG)
**Touches:** `templates/CLAUDE-global.md`, `CLAUDE.md`
**Files:** `templates/CLAUDE-global.md`, `CLAUDE.md`
**Depends on:** D1, D2.

`templates/CLAUDE-global.md`: model-tier/profile section update. Project `CLAUDE.md`: M85/M86
section describing the profile dimension + invoke-time injection. FLAG (do NOT silently write) the
live `~/.claude/CLAUDE.md` mirror for the user — surface the diff at completion (template + live
must match, but the live file stays OUT of D4's owned set). (Doc scaffolding — Document Ripple
gate + template/live-parity rule.)

### M86-D4-T7 — version bump
**Touches:** `package.json`
**Files:** `package.json`
**Depends on:** all D1–D4 landed (bump reflects the shipped feature).

Minor bump `4.4.10` → `4.5.10` (new feature; patch resets to two-digit `10`). The progress.md /
README version-line bump is part of complete-milestone, not D4.

---

## Acceptance bindings → milestone ACs (this domain)

| Milestone AC | Bound task(s) | Impl path | Killing test |
|--------------|---------------|-----------|--------------|
| (f) no silent degradation | T1 (banner) + T2 (statusline) + T3 (status) | `scripts/gsd-t-auto-route.js`, `scripts/gsd-t-statusline.js` | T1/T2 `test/m86-surfacing.test.js` present/absent-named-default cases |
| Doc completeness (Document Ripple gate) | T4+T5+T6 | help/README/GSD-T-README/CLAUDE | Document Ripple Completion Gate |

D4 is the most-deferrable — it can land last in the wave without blocking D1/D2/D3.
**Note:** T1/T2 introduce `test/m86-surfacing.test.js`. It is OWNED BY D4 (a NEW test file,
disjoint from D1's `test/m86-policy-profiles.test.js` and D3's lint tests — added to D4's owned
set during execute; declared here so the gate sees the killing test).
