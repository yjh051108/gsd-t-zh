/**
 * GSD-T framework-default TRACE module (M100).
 *
 * Trace is a capture-everything DEBUGGING SIGNAL STREAM. Transient. PII-barred.
 * Toggleable. It is NOT an audit log, NOT PII storage — this self-declaration
 * is load-bearing (see trace-logging-contract.md §Definition). NEVER share a
 * file, module, or record shape with the audit substrate
 * (templates/logging/audit-module.template.ts) — the two streams must never
 * collapse into one.
 *
 * Contract: .gsd-t/contracts/trace-logging-contract.md v1.0.0
 * Consumed seam: bin/gsd-t-logging-scaffolder.cjs (scaffoldLogging()) — d1
 * Consumed gate: bin/gsd-t-logging-envelope-check.cjs (checkEnvelope()) — d3
 *
 * This file is a TEMPLATE copied into a project by `gsd-t-init` scaffolding
 * (per M100-D1's scaffolder). The `{Project Name}` token and the storage
 * seam wiring below are the only pieces adapted per project; the envelope,
 * toggle, PII bar, and fire-and-forget contract are framework-fixed and must
 * not be edited by hand after scaffolding.
 */

// ── The trace envelope (contract-fixed; `category` set is per-project) ─────

export interface TraceRecord {
  ts: string; // ISO-8601 — when the trace point fired
  category: string; // member of the PROJECT-VARYING category set (see gsd-t-trace-distill.cjs)
  decision: boolean | null; // the decision at this point, or null when not a decision
  detail: string; // human-readable one-line description
  key?: string; // optional correlation/request id
  status?: number; // optional HTTP/status code
  data?: Record<string, unknown>; // optional payload — SUBJECT TO THE PII BAR
}

// ── The toggle: runtime seam + env override (both required, KEEP-plus-extend) ─

let _traceOn = process.env.TRACE === "1";

/** One-line in-module runtime seam (the BinVoice pattern). */
export function setTraceEnabled(on: boolean): void {
  _traceOn = !!on;
}

/** Reads the current toggle state (env override seeds the initial value). */
export function isTraceEnabled(): boolean {
  return _traceOn;
}

// ── The PII bar (HC-003 spirit — non-negotiable) ────────────────────────────
//
// Recurses into every field (including nested `data`) — never a top-level-
// only scan. Rejects email/phone/postal-address-shaped values at ANY nesting
// depth. Must NOT false-positive on legitimate long numeric ids, UUIDs, or an
// internal id string that merely contains '@' without a valid email shape.

// The trailing lookahead allows a closing quote/bracket/angle-bracket/brace
// immediately after the TLD (JSON string bodies, `Name <email>` headers,
// array literals) — without these, an email immediately followed by `"`,
// `>`, `]`, or `}` was NOT matched. Keep identical to the copy in
// bin/gsd-t-logging-envelope-check.cjs.
const EMAIL_RE = /(?<![^\s(])[^\s@()]+@[^\s@()]+\.[a-zA-Z]{2,}(?![^\s).,;:!?"'>\]}])/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]*)?$/;
const PHONE_RE = /(?<!\d)\+?\(?\d{1,4}\)?[\s.-]\d{2,4}[\s.-]\d{2,4}(?:[\s.-]\d{2,4})?(?!\d)/;
const ADDRESS_RE =
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl)\b/i;

function isPhoneShaped(value: string): boolean {
  const matches = value.match(new RegExp(PHONE_RE.source, "g")) || [];
  return matches.some((m) => !ISO_DATE_RE.test(m) && !ISO_DATE_RE.test(value.trim()));
}

function isPiiString(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (ISO_DATE_RE.test(value.trim())) return false; // structural timestamp, not PII
  if (EMAIL_RE.test(value)) return true;
  if (isPhoneShaped(value)) return true;
  if (ADDRESS_RE.test(value)) return true;
  return false;
}

function scanForPii(value: unknown, pathParts: string[], hits: string[], depth: number): void {
  if (depth > 12) return; // defensive recursion cap, not a real-world limit
  if (value == null) return;
  if (typeof value === "string") {
    if (isPiiString(value)) hits.push(pathParts.join("."));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanForPii(v, pathParts.concat(String(i)), hits, depth + 1));
    return;
  }
  if (typeof value === "object") {
    for (const k of Object.keys(value as Record<string, unknown>)) {
      scanForPii((value as Record<string, unknown>)[k], pathParts.concat(k), hits, depth + 1);
    }
  }
}

/**
 * Throws when a PII-shaped value is found anywhere in the given record's
 * fields, EXCEPT the structural `ts` timestamp. Matches the gate's own scan
 * scope (bin/gsd-t-logging-envelope-check.cjs checkEnvelope): every field —
 * `detail`, `category`, `key`, `data` — is subject to the PII bar, not just
 * `data`. The contract says "PII barred in ANY field"; scanning only `data`
 * here would let PII through the emitter that the verify gate would reject.
 */
function assertNoPii(record: Record<string, unknown>): void {
  const hits: string[] = [];
  for (const field of Object.keys(record)) {
    if (field === "ts") continue;
    scanForPii(record[field], [field], hits, 0);
  }
  if (hits.length > 0) {
    throw new Error(`trace-pii-barred: PII-shaped value at: ${hits.join(", ")}`);
  }
}

// ── The storage seam (dormant OR local-file; consumes d1's scaffolder) ─────
//
// ⚠ Divergence (PseudoCode-TraceLogging.md §Divergence): supersedes BinVoice's
// client-batched-POST → server-bulk-insert transport. A framework default
// must never silently lose a configured local sink — dormant only when truly
// no endpoint AND no local store is configured.

export interface TraceSink {
  write(record: TraceRecord): void | Promise<void>;
}

/** No-op sink used when no storage endpoint/local store is configured. */
const dormantSink: TraceSink = {
  write(): void {
    /* intentionally dormant — no endpoint or local store configured */
  },
};

let _sink: TraceSink = dormantSink;

/**
 * Wires the sink resolved from d1's `scaffoldLogging()` seam envelope
 * (`{ traceSink: { kind, path|table } }`). Called once at project bootstrap
 * with the project's own sink adapter (local-file writer, sqlite writer, or
 * db-table writer) built to match `traceSink.kind`. Framework template ships
 * the dormant default; the project wiring supplies the real sink.
 */
export function configureTraceSink(sink: TraceSink): void {
  _sink = sink || dormantSink;
}

function sink(): TraceSink {
  return _sink;
}

// ── The emitter (fire-and-forget; NEVER throws into the caller) ────────────

export interface TraceOptions {
  decision?: boolean | null;
  key?: string;
  status?: number;
  data?: Record<string, unknown>;
}

/**
 * Fire-and-forget trace emitter. Never throws into the calling app — a debug
 * channel must never break the app (trace-fire-and-forget). Off in normal
 * runs (zero cost) unless the toggle is enabled via `setTraceEnabled(true)`
 * or the `TRACE=1` env override.
 */
export function emitTrace(category: string, detail: string, options: TraceOptions = {}): void {
  try {
    if (!isTraceEnabled()) return;
    const record: TraceRecord = {
      ts: new Date().toISOString(),
      category,
      decision: options.decision ?? null,
      detail,
      ...(options.key !== undefined ? { key: options.key } : {}),
      ...(options.status !== undefined ? { status: options.status } : {}),
      ...(options.data !== undefined ? { data: options.data } : {}),
    };
    // Scan the FULL assembled record (every field except `ts`) — not just
    // `options.data` — so runtime enforcement matches the gate + contract.
    assertNoPii(record as unknown as Record<string, unknown>);
    sink().write(record);
  } catch (_err) {
    // Fire-and-forget: swallow every error, never throw into the caller.
    return;
  }
}
