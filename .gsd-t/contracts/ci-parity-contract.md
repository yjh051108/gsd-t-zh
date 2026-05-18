# Contract: ci-parity

Status: STABLE
Version: 1.0.0
Owner: m57-d2-ci-command-parity
Consumers: commands/gsd-t-verify.md (FAIL-blocking gate), `gsd-t ci-parity` CLI

## Purpose

Reproduce the project's actual CI build locally instead of assuming local
tsc/test parity. Closes the TimeTracking v1.10.12 stale-cache blind spot
(~8 `noImplicitAny` regressions passed warm-cache local tsc, failed CI).

## API

```
runCiParity({ projectDir, timeoutMs? }) → {
  ok: boolean,
  detectedSource: 'cloudbuild' | 'workflows' | 'dockerfile-run' | 'package-scripts' | 'none',
  commands: [{ cmd: string, exitCode: number, ok: boolean }],
  dockerBuilt: boolean,        // true only if Dockerfile present AND docker available AND build ran
  dockerSkippedReason?: string,// 'no-dockerfile' | 'docker-unavailable'
  note?: string
}
```

## Detection Precedence (LOCKED — user decision, do NOT reorder/extend)

1. `cloudbuild.yaml` present → run its `steps[].args` command sequence.
2. else `.github/workflows/*.yml` present → run `jobs[].steps[].run` commands.
3. else `Dockerfile` present → run its `RUN` lines.
4. else `package.json` → run `scripts.build`, `scripts.typecheck`,
   `scripts.test` (only those that exist, in that order).
5. none of the above → `detectedSource:'none'`, `ok:true`, `note` set.

Parsing is minimal line/regex (no YAML lib). Known limits documented in module
docblock + this contract: only the first job's steps for workflows; `args`
arrays joined with spaces for cloudbuild.

## Cache Clearing (MANDATORY, before running detected commands)

Remove, if present, under `projectDir`:
- every `*.tsbuildinfo`
- `node_modules/.cache`
- tsc incremental output dirs referenced by `tsconfig*.json` `outDir`/
  `tsBuildInfoFile` (best-effort)

Rationale: a warm local cache is exactly what masked the TimeTracking
regression. Skipping this step reintroduces the defect M57 closes.

## Docker Trigger (LOCKED — no opt-in flag)

`Dockerfile` present → run real `docker build` (bounded timeout, output
captured). The build failing → `ok:false`.
- `Dockerfile` absent → `dockerBuilt:false`, `dockerSkippedReason:'no-dockerfile'`.
- `docker` binary missing → `dockerBuilt:false`,
  `dockerSkippedReason:'docker-unavailable'`, NOT a hard failure (projects on
  hosts without a Docker daemon must still pass).

## Exit Codes (CLI)

| Code | Meaning |
|------|---------|
| 0 | `ok:true` — all detected commands + docker build (if applicable) passed |
| 4 | `ok:false` — ≥1 detected command failed OR docker build failed |
| 2 | usage error |

## Success Criterion Binding

SC2: `runCiParity` on a fixture project with a `Dockerfile` and a planted tsc
strict regression that a warm-cache local `tsc` would NOT catch runs the real
`docker build`, which fails → `ok:false`, CLI exit 4.
