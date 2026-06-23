# Constraints: m93-jargon-lint (M93 D3)

- Zero external deps; pure; never throws (bad input → exit 64).
- FLAG, don't auto-fix (auto-glossing is LLM judgment, out of scope).
- Conservative allowlist + path-exempt list (mirror date-guard) so it doesn't false-flag common English caps or machine-written files.
- Skip fenced code blocks + inline-code spans — a token in code is a reference, not prose jargon.
- First-occurrence-only — a token glossed once then reused bare must pass (don't nag).
- Structural detection (token regex + gloss-proximity), never a blanket "no caps" rule.
- Does NOT wire itself into the Pre-Commit Gate / commit hook (integrate-seam — ship the CLI + register in PROJECT_BIN_TOOLS at integrate).
- File-disjoint from D1 (the Stop hook) and D2 (CLAUDE-global + prompts).
