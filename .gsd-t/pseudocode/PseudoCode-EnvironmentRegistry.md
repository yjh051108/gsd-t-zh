# PseudoCode — Environment Registry

**Purpose:** Record every non-local (and local) environment's connection MAP into `docs/infrastructure.md` — via TWO triggers on ONE mechanism: **(1) record-at-create** (greenfield: GSD-T builds an env → records as it creates) and **(2) capture-on-first-need** (brownfield: an existing project's undocumented env → on first non-local access HALT → capture → write map + permission → THEN proceed). The AI never re-discovers a URL, credential location, or connect command; a missing entry HALTs and documents (never guesses, never greps transcripts). Document-first, then act — so the FIRST need is the LAST rediscovery.

---

## Design anchor: this EXTENDS two things that already exist
- The `docs/infrastructure.md` Living Document (already owns "commands, DB setup, server access, creds").
- The M100 logging-scaffolder's **stop-for-approval + record-to-disk + marker-delimited doc block** shape (`bin/gsd-t-logging-scaffolder.cjs`). We clone that shape, not invent a new one.

---

## CURRENT (today — the gap)

```
# templates/infrastructure.md has free-text "Database > Direct Access > Production: {command}"
#   and a "Credentials > Production" table. No PER-ENVIRONMENT structured row.
# No capture mechanism: nothing writes an env entry when GSD-T builds a test DB / provisions a server.
# No read-first-then-HALT gate for env access — the AI re-greps transcripts or guesses a connstring.
# Result: Binvoice moved Aiven -> Neon; doc kept stale Aiven placeholders; every remote DB command re-prompts.
```

## PROPOSED

### A. Schema — one Environments table in docs/infrastructure.md (COMMITTED, map-only, zero secrets)

```
## Environments   <!-- gsd-t-env-registry:start -->

| id | scope | kind | host | port | db/name | auth method | secret env-var NAME | connect command | access gotchas | read-only default | recorded |
|----|-------|------|------|------|---------|-------------|---------------------|-----------------|----------------|-------------------|----------|
# scope   = local | staging | prod
# kind    = postgres | mysql | redis | http-api | ssh-host | ...
# secret env-var NAME = e.g. DATABASE_URL_PROD  — the NAME only, NEVER the value
# connect command references the env-var by name: `psql "$DATABASE_URL_PROD"`
# access gotchas = VPN required | IP-allowlist | SSH-tunnel via bastion X | none
# read-only default = YES for scope=prod unless human explicitly recorded write-ok
<!-- gsd-t-env-registry:end -->
```

### B. TRIGGER 1: record-at-create hook — greenfield (proactive, not reactive)

```
# FIRES whenever GSD-T CREATES/PROVISIONS/CONFIGURES an environment — same pass, right then:
WHEN gsd-t builds a local test DB
  OR provisions/configures a remote server
  OR sets up credentials
  OR hands the user setup instructions for any env:
    # It HAS url + port + auth method + secret-var-name + connect command RIGHT NOW.
    recordEnvironment({ projectDir, scope, kind, host, port, name, authMethod,
                        secretEnvVarName, connectCommand, gotchas, readOnlyDefault })
      -> upsert row into docs/infrastructure.md Environments table (marker-delimited, idempotent)
      -> if scope==prod and readOnlyDefault unset -> default YES  # Destructive-Action Guard
      -> NEVER write a secret VALUE; only the env-var NAME
    # Reuse the scaffolder's marker-replace idempotent doc-writer verbatim (renamed markers).

# Capture points to wire (evidence-backed seams):
#   - commands/gsd-t-init.md      (infra doc creation)
#   - commands/gsd-t-populate.md  ("For docs/infrastructure.md" section — extract from .env.example/ORM/docker-compose)
#   - any execute/quick task whose work provisions or configures an env
```

### C. Read-first gate — TRIGGER 2: capture-on-first-need (brownfield) (extends No-Re-Research; obeys No-Fallback-Ever)

```
WHEN the AI needs to reach a NON-LOCAL environment:
    entry = lookupEnvironment(scope, kind)   # parse the Environments table (No-Re-Research: doc FIRST)
    IF entry exists:
        use entry.connectCommand              # secret pulled from entry.secretEnvVarName at runtime
        IF scope==prod AND entry.readOnlyDefault==YES AND operation is a write:
            HALT -> ask human to confirm write intent   # Destructive-Action Guard
    IF entry missing:
        # This is Binvoice's live case: prod exists but is UNDOCUMENTED.
        # NOT ask-and-stop-forever. NOT grep-the-transcripts. Document-first, then act:
        HALT the connect attempt
        detected = detectEnvConfig(projectDir)   # reuse detectStack-shape (bin/gsd-t-logging-scaffolder.cjs:51):
                                                 #   .env.example var NAMES, connection-string shapes,
                                                 #   neonctl/vercel/psql presence in deps/PATH
        proposed = buildProposedEntry(scope, kind, detected)   # map only — NEVER a secret value
        ask human to confirm/fill gaps in `proposed`   # the ONE sanctioned pause (scaffolder shape)
        recordEnvironment(proposed)             # writes the map row to the Environments table
        addPermissionEntry(projectDir, proposed.connectCommand)  # .claude/settings.json allow-entry
        THEN proceed with the connect            # first need = last rediscovery
        # ZERO fallback: never a guessed connstring, never a transcript-grep rediscovery,
        #   never proceed-on-missing. The HALT resolves by DOCUMENTING, not by guessing.
```

### D. Re-provision / staleness (Aiven -> Neon lesson)

```
WHEN an env is re-provisioned (host/name/auth changes):
    recordEnvironment(... same scope+kind ...)  # upsert by (scope, kind) key -> REPLACES the stale row
    # Because capture is at setup-time, the move itself triggers the rewrite. No stale placeholder survives.
```

---

## Summary

| Concern | Design | Reused from |
|---------|--------|-------------|
| Where map lives | Environments table in `docs/infrastructure.md`, committed | Living Document (already owns this) |
| Trigger 1 (greenfield) | record-at-CREATE, same pass GSD-T builds the env | user insight (proactive) |
| Trigger 2 (brownfield) | capture-on-first-NEED: HALT → detect+ask → record+permission → proceed | No-Re-Research read-first gate |
| One mechanism | both triggers call the SAME `recordEnvironment` upsert | — |
| Auto-detect (brownfield) | `.env.example` NAMES, connstring shapes, neonctl/vercel presence | `detectStack` (scaffolder:51) |
| Doc writer | marker-delimited idempotent upsert | `writeChoiceToProjectDocs` (M100 scaffolder) |
| Approval-stop | STOP-for-human shape | `scaffoldLogging` PAUSED envelope |
| Permission add | `.claude/settings.json` allow-entry for the connect command | `configureArchitectHook` writer (gsd-t.js:944) |
| Secrets split | env-var NAME only in doc; value in gitignored .env | HARD CONSTRAINT 1 |
| Missing entry | HALT + document, zero fallback (no guess/no transcript-grep) | No-Fallback-Ever Doctrine |
| Prod safety | read-only default YES for prod | Destructive-Action Guard |
| Staleness | upsert by (scope,kind) replaces stale row | record-at-create/re-provision |
