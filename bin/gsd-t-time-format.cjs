/**
 * gsd-t-time-format — M59
 *
 * Shared helpers for the v3.29.10 timestamp-precision format.
 *
 * Exports:
 *   localIsoWithOffset([date])  → "YYYY-MM-DDTHH:MM:SS±HH:MM" (local offset)
 *   localTimestampForProgress([date]) → "YYYY-MM-DD HH:MM TZ"  (human-readable, for progress.md fields)
 *
 * Both helpers source the current time from `new Date()` by default. The
 * `[GSD-T NOW]` UserPromptSubmit signal feeds the system clock, so these
 * are correct in any GSD-T spawn.
 */

const TZ_ABBR_FALLBACK = 'UTC';

function pad2(n) {
  const s = String(n);
  return s.length < 2 ? `0${s}` : s;
}

/**
 * ISO 8601 timestamp with local timezone offset (NOT UTC `Z`).
 *
 * Example: `2026-05-27T10:15:30-07:00` (PDT, summer)
 *          `2026-12-15T10:15:30-08:00` (PST, winter)
 */
function localIsoWithOffset(date) {
  const d = date instanceof Date ? date : new Date();
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());

  const offsetMinTotal = -d.getTimezoneOffset(); // east of UTC is positive
  const sign = offsetMinTotal >= 0 ? '+' : '-';
  const offsetAbs = Math.abs(offsetMinTotal);
  const offH = pad2(Math.floor(offsetAbs / 60));
  const offM = pad2(offsetAbs % 60);

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${sign}${offH}:${offM}`;
}

/**
 * Resolve a short human-readable TZ abbreviation (e.g., "PDT", "PST").
 * Uses Intl.DateTimeFormat short timezone where available; falls back to
 * the numeric offset string if the platform doesn't provide one.
 */
function shortTzAbbr(date) {
  const d = date instanceof Date ? date : new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZoneName: 'short',
    }).formatToParts(d);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    if (tzPart && tzPart.value) {
      // Intl may return "GMT+8" on some platforms — strip numeric offset to "GMT"
      const letters = tzPart.value.replace(/[^A-Za-z]/g, '');
      return letters || TZ_ABBR_FALLBACK;
    }
  } catch {
    /* fall through */
  }
  // Fallback — always return a clean alphabetic abbreviation
  return TZ_ABBR_FALLBACK;
}

/**
 * Human-readable timestamp for progress.md visible fields:
 *   "YYYY-MM-DD HH:MM TZ"
 *
 * Example: `2026-05-27 10:15 PDT`
 *
 * This is the M59 format for:
 *   - `## Date:` line in progress.md frontmatter
 *   - "Completed" cell in the Completed Milestones table
 *   - "Date" cell in the Session Log table
 */
function localTimestampForProgress(date) {
  const d = date instanceof Date ? date : new Date();
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} ${shortTzAbbr(d) || TZ_ABBR_FALLBACK}`;
}

module.exports = {
  localIsoWithOffset,
  localTimestampForProgress,
  shortTzAbbr,
};
