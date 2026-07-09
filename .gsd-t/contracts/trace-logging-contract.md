# Trace Logging Contract

**Version:** 1.0.0 DRAFT (fixed at Altitude-2 sign-off; STABLE at milestone completion)
**Status:** DRAFT — authored at M100 DEFINE. Fields settle at contract sign-off; enforcement lands in `gsd-t-verify`.
**Subject:** the required TRACE-entry ENVELOPE, the PII bar, the toggle requirement, and the trace-vs-audit no-collapse boundary.
**Milestone:** M100 — Universal Trace + Audit Logging (framework defaults).
**Reference (READ-ONLY):** BinVoice `src/trace/` + `shared/src/dto/trace-record.ts`. BinVoice is grounded reference, NEVER modified.

---

## What this contract fixes (and what it deliberately does NOT)

This contract fixes the **envelope** (the required shape of one trace entry) and the **rules** every trace stream obeys. It does NOT fix the **schema** — the concrete trace CATEGORY set VARIES per project (a browser extension's `Post`/`Image`/`Egress` ≠ a transcription app's `AudioChunk`/`VAD`/`DeviceSwitch`). A per-project distillation step teases out the concrete category list at build time AGAINST this envelope. The enforcement gate therefore checks the SHAPE structurally and NEVER hardcodes a category value (`feedback_coverage_check_structural_not_substring`).

## Definition

**Trace** = a capture-everything DEBUGGING SIGNAL STREAM. Transient. PII-barred. Toggleable. May rotate/purge freely. It is **NOT an audit log, NOT PII storage** — this self-declaration (mirroring the BinVoice DTO header) is load-bearing; a trace stream that carries accountability records or PII violates this contract.

## Required trace-entry envelope

Every trace entry MUST carry these fields (mirrors the verified BinVoice `TraceRecord` DTO):

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `ts` | `string` (ISO-8601) | REQUIRED | When the trace point fired. |
| `category` | `string` | REQUIRED | A member of the PROJECT-VARYING category set (distilled per project). The gate checks presence + type, NEVER a hardcoded value. |
| `decision` | `boolean \| null` | REQUIRED | The decision at this trace point (`true`/`false`), or `null` when the point is not a decision. Presence required; value may be `null`. |
| `detail` | `string` | REQUIRED | Human-readable one-line description of what happened. |
| `key` | `string` | optional | A correlation/match key (e.g. request id). |
| `status` | `number` | optional | An HTTP/status code when the point wraps a transmission. |
| `data` | `Record<string, unknown>` | optional | Arbitrary structured payload — SUBJECT TO THE PII BAR below. |

## The PII bar (HC-003 spirit — non-negotiable)

A trace entry MUST NOT carry buyer/end-user PII — no emails, phone numbers, or postal addresses — in any field, including `data`. The enforcement gate REJECTS a trace envelope carrying a PII-shaped field. Trace is a debugging signal stream, not a data store; PII belongs nowhere in it.

### PII matcher shape — EXACT definition (pre-mortem F6 — recursion + false-positive boundary)

The matcher MUST **recurse into nested structures** (`data`, `context`) — not scan top-level strings only — and MUST NOT false-positive on legitimate ids:

- **Rejected (PII-shaped), at ANY nesting depth incl. `data.a.b.email`:** an **email** (`local@domain.tld` with a real TLD), a **phone number** (a 7–15-digit run matching common phone groupings, not a bare id), a **postal address** (street-number + street-name + suffix / ZIP-shaped patterns).
- **MUST PASS (not PII):** a legitimate long numeric `key`/`request-id`/`sellerId` (a 10+ digit id is NOT a phone unless it matches phone grouping); an internal id STRING that contains `@` but is not a real email (no valid TLD / not `local@domain.tld` shape); a UUID.
- The matcher walks nested objects/arrays recursively; a nested email (`data.user.contact.email`) is caught, a nested legit id is not. Depth ≥2 PII (phone, address) is rejected; depth ≥2 legit ids pass.

## Toggle requirement (runtime + env — David's stated choice)

A conformant trace module MUST expose BOTH toggle paths:
1. A one-line in-module runtime seam — `setTraceEnabled(boolean)` / `isTraceEnabled()` (the BinVoice pattern).
2. An environment override — `TRACE=1` (flip without code).

The emitter is **fire-and-forget** and MUST NEVER throw into the calling app (a debug channel must never break the app). When no storage endpoint is configured, the channel may soft-dormant OR write to the local scaffolded store — it MUST NOT no-op silently in a way that loses a configured local sink.

## Default + opt-out (M100 correction — the "no opt-out" rule was too absolute)

Trace is a default for EVERY project EXCEPT explicit opt-out. The original M100 design declared trace "no opt-out, every project," but that is wrong for a whole project CLASS: a **stateless CLI / library / methodology package** has NO runtime data-flow (data packets, events, transmissions, live decisions) to trace — the thing trace exists to capture simply does not occur. Forcing a token trace module onto such a project is theater. So trace gets a symmetric opt-out, mirroring audit's.

### §opt-out-record — canonical trace opt-out shape

- **Canonical path**: `.gsd-t/trace-optout.json` at the project root.
- **Canonical shape** (exactly): `{ "traceOptOut": true, "reason": "<non-empty string>" }`.
- **Field rules**: `traceOptOut` REQUIRED, MUST be exactly `true`; `reason` REQUIRED, non-empty string. Any other shape → NOT a valid opt-out (fail-closed; treated as absent).
- **Validity**: the gate's `trace-default-except-optout` check treats a project with NO trace module/store AND a valid opt-out record as conformant. A project with a trace module still has its records validated (opt-out does not disable validation of records that DO exist).
- **When to opt out**: a stateless CLI/library with no app-runtime surface (e.g. GSD-T itself). A running application — anything with requests, jobs, integrations, or user sessions — should NOT opt out (that's the debugging-blind failure trace exists to prevent).

## Storage (stack-adaptive, human-approval-gated)

Storage is NOT fixed by this contract — it is chosen at `gsd-t-init` scaffolding time, STACK-ADAPTIVE, and the scaffolder MUST STOP for human approval presenting alternatives (has-DB → `trace_logs`-style table; no-server/desktop → local rotating JSONL). The contract fixes the ENVELOPE; storage is whatever fits the stack, never silently picked.

## The no-collapse boundary (load-bearing)

Trace and AUDIT are TWO DISTINCT STREAMS and MUST NEVER collapse into one. A trace envelope MUST NOT be reused as an audit record and vice-versa. The `decision:boolean|null` field is a TRACE marker; audit's `{actor, action, target, before, after}` is an AUDIT marker. A single shared stream/store serving both is a contract VIOLATION (the BinVoice admin "Trace" view is explicitly NOT an audit log — repeating that conflation is the exact anti-pattern to avoid). See [`audit-logging-contract.md`](audit-logging-contract.md).

## Enforcement (`gsd-t-verify`)

`gsd-t-verify` enforces this contract STRUCTURALLY:
- A trace envelope missing a REQUIRED field (`ts`/`category`/`decision`/`detail`) → FAIL.
- A trace envelope with a wrong-typed required field → FAIL.
- A trace envelope carrying a PII-shaped field → FAIL.
- A project routing audit events into the trace stream (or vice-versa) → FAIL (no-collapse).
- A novel `category` value → PASS (the gate never hardcodes categories).

## Guard map ([RULE] IDs → falsifiable acceptance)

| [RULE] | Guarantees | Falsifier (→ FAIL) | Acceptance # |
|--------|------------|--------------------|--------------|
| `trace-envelope-structural` | required fields present + typed, categories free | missing/wrong-typed field passes, or novel category fails | 3 |
| `trace-pii-barred` | no buyer PII in any field | an email/phone/address field passes | 5 |
| `trace-toggle-runtime-and-env` | both `setTraceEnabled()` and `TRACE=1` exist | either toggle path absent | 2, 15 |
| `trace-fire-and-forget` | emitter never throws into caller | an emit path that can throw into the app | (module contract test) |
| `no-collapse` | trace ≠ audit, separate streams | a collapsed single-stream impl passes | 6 |
| `storage-approval-paused` | storage chosen via human pause | scaffolder writes a backend with no recorded approval | 1, 2 |

---

## ⚠ Divergence flags (keep-or-supersede over the inherited BinVoice trace model)

See [`PseudoCode-TraceLogging.md`](../pseudocode/PseudoCode-TraceLogging.md) §Divergence for the full keep-or-supersede ledger. Summary: the ENVELOPE shape, the `decision:boolean|null` field, the runtime `setTraceEnabled()` seam, and the fire-and-forget/never-throw emitter are KEPT (no flag). The `TRACE=1` env override is an EXTENSION alongside the runtime flag (KEEP-plus-extend, no flag on the seam). The BinVoice-web client-batched-POST → server-bulk-insert → newest-first-viewer TRANSPORT is SUPERSEDED by the stack-adaptive storage seam (⚠ Divergence flag). The soft-dormant-when-no-endpoint behavior is SUPERSEDED into "dormant OR local-file" for a framework default (⚠ Divergence flag).
