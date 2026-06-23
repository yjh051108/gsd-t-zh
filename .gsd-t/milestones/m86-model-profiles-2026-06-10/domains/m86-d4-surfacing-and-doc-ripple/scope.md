# Domain: m86-d4-surfacing-and-doc-ripple

**Milestone:** M86 — Model Profiles (standard/pro/premium tier-spend switch)
**Role:** LOW-RISK additive consumer work, separated so it never gates the risky core.

## Thesis

Surface the active profile and complete the full doc-ripple. This is the most-deferrable work
and a different blast radius than D1's policy module — isolated from the safety-critical (D3) and
sandbox-fragile (D2) domains so it never gates them.

## Owned Files (this domain WRITES these — no other domain may)

| File | Why |
|------|-----|
| `scripts/gsd-t-auto-route.js` | Surface active profile in the `[GSD-T ...]` session-banner token line. |
| `scripts/gsd-t-statusline.js` | Surface active profile in the statusline. |
| `commands/gsd-t-status.md` | Describe the new active-profile line in `gsd-t status` rendering. |
| `commands/gsd-t-help.md` | Document the `gsd-t model-profile` command. |
| `README.md` | Commands table row + new Profiles section. |
| `GSD-T-README.md` | Profiles documentation. |
| `templates/CLAUDE-global.md` | Profiles + model-tier section update (template). |
| `CLAUDE.md` | Project M85/M86 section update. |
| `package.json` | Minor version bump. |
| `test/m86-surfacing.test.js` | NEW — killing test for the banner/statusline active-profile surfacing (SC(f) present/absent named-default). Disjoint from D1's `test/m86-policy-profiles.test.js` and D3's lint tests. |

## Deliverables

1. **Banner surfacing** — `scripts/gsd-t-auto-route.js` resolves the active profile (from
   `.gsd-t/model-profile.json` via D1's resolver, global-default NAMED when absent — no silent
   degradation per SC(f)) and prints it in the `[GSD-T ...]` token line.
2. **Statusline surfacing** — `scripts/gsd-t-statusline.js` shows the active profile.
3. **`gsd-t status` rendering** — `commands/gsd-t-status.md` describes the new active-profile line
   (named choice, never an implicit fallback — SC(f)).
4. **Full doc-ripple:**
   - `README.md` — commands table row for `model-profile` + a Profiles section (the 3-profile
     spend table + per-stage override + per-project config).
   - `GSD-T-README.md` — Profiles documentation.
   - `commands/gsd-t-help.md` — `gsd-t model-profile` entry.
   - `templates/CLAUDE-global.md` — model-tier/profile section. FLAG the live `~/.claude/CLAUDE.md`
     equivalent for the user (template + live must match — do not silently edit the user's live file
     without surfacing it).
   - `CLAUDE.md` (project) — M85/M86 section update describing the profile dimension.
   - `package.json` — minor bump (new feature: 4.4.10 → 4.5.10, patch reset to 10).

## NOT Owned (other domains)

- The policy module / config schema / CLI brain / contract → D1 (D4 CONSUMES the resolver for
  surfacing only; it does NOT edit `bin/`).
- Workflow source + invoker command files (partition/verify/debug) → D2.
- The drift lint → D3.

## Dependencies

- **Inbound:** D1's published resolver (for the banner/statusline/status to name the active
  profile). Code against the contract seam.
- D4 is the most-deferrable; it can land last in the wave without blocking D1/D2/D3.
