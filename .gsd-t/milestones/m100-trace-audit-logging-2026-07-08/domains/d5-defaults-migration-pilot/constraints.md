# Constraints: d5-defaults-migration-pilot

## Must Follow
- Two CLAUDE.md hard rules mirrored across ALL reference docs in the same pass (Document Ripple Completion Gate): `templates/CLAUDE-global.md` + `README.md` + `GSD-T-README.md` + `commands/gsd-t-help.md`.
- Migration is ADDITIVE / non-destructive — proven on a THROWAWAY fixture, NOT on UMI (Destructive Action Guard).
- Migration dispatch case is DELEGATED to d1 (owner of `bin/gsd-t.js`) via `logging-scaffold-seam-contract.md` — d5 does NOT edit `bin/gsd-t.js`.
- UMI pilot: ALL files live in the SEPARATE repo `/Users/david/projects/UMI-Automation` — trivially file-disjoint from every GSD-T-repo domain.
- UMI trace/audit distilled from UMI's ACTUAL plan — never confabulate (`feedback_no_confabulated_examples`): trace on Grain/Airtable/Anthropic/Apify REST calls; audit on PodCoach draft-approval steps.
- UMI must have BOTH streams, pass d3's envelope gate for both, with no-collapse; record the storage choice in UMI's own CLAUDE.md.
- No other project touched (#16).

## Must Not
- Modify files outside owned scope (esp. `bin/gsd-t.js` — d1 owns it).
- Run the migration destructively against any real repo (throwaway fixture only).
- Update 3 of 4 reference docs then report done (Document Ripple Completion Gate).
- Confabulate UMI categories/actions — ground them in UMI's real plan.

## Dependencies
- Depends on: ALL machinery — d1 (seam + dispatch), d2 (trace module + distiller), d3 (envelope gate), d4 (audit module + distiller).
- Depended on by: nothing (lands last — Waves 3-4).
