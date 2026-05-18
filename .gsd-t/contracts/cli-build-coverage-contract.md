# Contract: cli-build-coverage

Status: STABLE
Version: 1.0.0
Owner: m57-d1-build-coverage-check
Consumers: commands/gsd-t-verify.md (FAIL-blocking gate), `gsd-t build-coverage` CLI

## Purpose

Detect new top-level paths added in a milestone's commit range that no CI build
artifact references — the TimeTracking v1.10.12 failure class (new `hooks/` dir
committed, absent from Dockerfile `COPY`, shipped broken while verify passed).

## API

```
checkBuildCoverage({ projectDir, baseRef, headRef, _newPaths }) → {
  ok: boolean,
  missing: string[],          // top-level paths not referenced by any CI artifact
  checkedAgainst: string[],   // which CI artifacts were detected & scanned
  newPaths: string[],         // all new top-level paths in baseRef..headRef
  note?: string               // set when no CI artifacts exist or diff is empty
}
```

- `projectDir` (string, required) — project root.
- `baseRef` / `headRef` (string, optional) — git refs bounding the milestone
  commit range. **Default when omitted**: `HEAD~1..HEAD`. (Plan phase MAY refine
  to a milestone-tag heuristic; the fallback stays `HEAD~1..HEAD`.)
- `_newPaths` (string[], optional, **test seam**) — when provided, bypasses
  `git diff --name-only` entirely and uses this list as the set of changed
  file paths. Callers collapse to top-level segments via the same helper.
  Intended for unit tests; not exposed via the CLI.

**Throws `UsageError`** (not returned in envelope) when git state is unusable:
no git repo, bad refs, or identical baseRef/headRef. The CLI catches this and
exits 2. The `checkBuildCoverage` function itself never throws for CI-artifact
conditions — those are expressed in the return envelope.

## Detection Rules — a new top-level path is "covered" if referenced by ANY of:

1. `Dockerfile` — a `COPY` or `ADD` directive whose source path includes the
   top-level segment (line-based scan). `COPY --from=` (multi-stage image copy)
   is excluded — those reference image layers, not workspace paths.
2. `cloudbuild.yaml` — appears in any `steps[].args` or artifact/copy path
   (line/regex path-segment scan; no YAML lib).
3. `.github/workflows/*.yml` — appears as a path segment in any workflow file
   (line/regex path-segment scan; no YAML lib).

`COPY . .` (or `ADD . .`) sets `coversAll:true` → `missing` is always empty
regardless of what top-level paths appear in the diff.

The parsers for cloudbuild.yaml and workflow YAML use a heuristic line scan
(`/\b([a-zA-Z0-9_.-]+)\//g`) — any `segment/` pattern in a line is treated as
a covered path reference. This is intentionally conservative (false positives
are acceptable; false negatives are not).

## Exit Codes (CLI)

| Code | Meaning |
|------|---------|
| 0 | `ok:true` — all new paths covered, OR no CI artifacts exist (`note` set) |
| 4 | `ok:false` — ≥1 new top-level path uncovered (`missing[]` non-empty) |
| 2 | usage error (bad args, not a git repo, bad refs) |

## Defensive Behavior

- No git repo / detached HEAD / identical refs → `UsageError` thrown (not
  returned in envelope); CLI catches and exits 2 with a clear message.
- No CI artifacts at all → `ok:true`, `note:"no CI artifacts detected"`, exit 0
  (nothing to be inconsistent with — this is not a failure).
- Empty diff → `ok:true`, `newPaths:[]`, `note:"empty diff"`, exit 0.

## Success Criterion Binding

SC1: `checkBuildCoverage` on a fixture where a new `hooks/` dir is committed but
absent from the Dockerfile `COPY` directives returns `ok:false`,
`missing:["hooks"]`, CLI exit code 4.
