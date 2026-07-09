# GSD-T: Migrate Logging — Brownfield Trace + Audit Retrofit

Scaffolds the two framework-default logging streams — **trace** (transient debug signal, no opt-out) and **audit** (durable accountability record, default except explicit opt-out) — into an EXISTING project, additively. See `~/.claude/CLAUDE.md` § Logging Defaults for the two hard rules this command implements.

## What this does

- Copies the trace module template (`templates/logging/trace-module.template.ts`) to `src/logging/trace.ts` — **only if that file does not already exist**.
- Copies the audit module template (`templates/logging/audit-module.template.ts`) to `src/logging/audit.ts` — **only if that file does not already exist**.
- Distills the per-project trace category / audit action schema from the project's own plan (when `--plan` is given) into `.gsd-t/logging-schema.json` — never confabulated; an unstated category/action is a gap, not a guess.
- Runs d1's stack-adaptive storage scaffolder (`scaffoldLogging()`), which detects the stack and **pauses for human approval** before recording a storage backend — never silently picks one.

## Non-destructive guarantee (MANDATORY)

This command is **purely additive**. Every write is preceded by an existence check; a file that already exists in the target project is left byte-for-byte untouched. It is proven non-destructive on a throwaway fixture in `test/m100-d5-migration-fixture.test.js` — a run that modifies or deletes any pre-existing fixture file is a test FAILURE.

## Usage

```
gsd-t migrate-logging <projectDir> [--plan <path-to-plan.md>] [--approve <db-table|local-sqlite|local-jsonl>]
```

- `<projectDir>` — required. The existing project to retrofit.
- `--plan <path>` — optional. Distills the concrete trace category / audit action set from this plan file. Omit to get an empty (never invented) schema.
- `--approve <backend>` — optional. Approves a storage backend up front (`db-table` / `local-sqlite` / `local-jsonl`). Omit to let the scaffolder pause and present alternatives first.

## Step 1: Run the migration

Invoke the module via the CLI dispatch (owned by d1 — `bin/gsd-t.js` `case "migrate-logging"`; the module itself is owned by this domain, see `.gsd-t/contracts/logging-scaffold-seam-contract.md`):

```bash
gsd-t migrate-logging "$ARGUMENTS"
```

## Step 2: Report

Show the created/skipped file lists and the storage scaffold result (approved backend, or the PAUSED alternatives list awaiting human approval) exactly as returned by the module — do not summarize away a PAUSED state as if it were complete.

## Step 3: If storage is PAUSED

Present the alternatives to the user and wait for an explicit backend choice (the ONE sanctioned pause against the Level-3 full-auto default — see `.gsd-t/contracts/logging-scaffold-seam-contract.md`). Re-run with `--approve <backend>` once chosen.

$ARGUMENTS

## Auto-Clear

All work is committed to project files. Execute `/clear` to free the context window for the next command.
