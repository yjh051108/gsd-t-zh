"use strict";

// M74 — the scan's concurrency gate is ADAPTIVE: on a rate-limit error it lowers its
// own ceiling (10→9→8…, floor MIN_CONCURRENT) + retries the agent with backoff, and
// recovers toward 10 after sustained success — so a transient rate limit throttles the
// run DOWN rather than failing it (the v4.0.19 empty-register wipeout). Logic mirrored
// here (the workflow is a runtime-native script, not requireable).

const { test } = require("node:test");
const assert = require("node:assert/strict");

const MIN_CONCURRENT = 4;
function makeAdaptiveSemaphore(initial) {
  let ceiling = initial, inUse = 0;
  const waiters = [];
  function pump() { while (inUse < ceiling && waiters.length) { inUse++; waiters.shift()(); } }
  return {
    async acquire() { if (inUse < ceiling) { inUse++; return; } await new Promise((r) => waiters.push(r)); },
    release() { inUse--; pump(); },
    lower() { if (ceiling > MIN_CONCURRENT) { ceiling--; return true; } return false; },
    raise() { if (ceiling < initial) { ceiling++; pump(); return true; } return false; },
    get ceiling() { return ceiling; },
    get inUse() { return inUse; },
  };
}
function isRateLimit(err) {
  const s = String((err && (err.message || err)) || "").toLowerCase();
  return /rate.?limit|temporarily limiting|429|overloaded|too many requests|capacity/.test(s);
}

test("isRateLimit recognizes the real server message + common variants", () => {
  assert.equal(isRateLimit(new Error("API Error: Server is temporarily limiting requests · Rate limited")), true);
  assert.equal(isRateLimit(new Error("429 Too Many Requests")), true);
  assert.equal(isRateLimit(new Error("overloaded_error")), true);
  assert.equal(isRateLimit(new Error("ECONNRESET")), false, "a non-rate-limit error must NOT trigger throttling");
  assert.equal(isRateLimit(null), false);
});

test("lower() shrinks the ceiling but never below the floor", () => {
  const g = makeAdaptiveSemaphore(10);
  for (let i = 0; i < 20; i++) g.lower();
  assert.equal(g.ceiling, MIN_CONCURRENT, "floor enforced");
});

test("raise() recovers toward the initial ceiling, never above", () => {
  const g = makeAdaptiveSemaphore(10);
  g.lower(); g.lower(); // 8
  assert.equal(g.ceiling, 8);
  for (let i = 0; i < 20; i++) g.raise();
  assert.equal(g.ceiling, 10, "recovers to initial, capped there");
});

test("a lowered ceiling stops granting new permits until in-use drops below it", async () => {
  const g = makeAdaptiveSemaphore(3);
  await g.acquire(); await g.acquire(); await g.acquire(); // inUse=3, ceiling=3
  let granted4 = false;
  const p = g.acquire().then(() => { granted4 = true; }); // queued
  g.lower(); // ceiling=2; inUse(3) > ceiling, so nothing grants
  await Promise.resolve();
  assert.equal(granted4, false, "no grant while inUse >= lowered ceiling");
  g.release(); // inUse=2, still not < ceiling(2)
  await Promise.resolve();
  assert.equal(granted4, false, "still blocked at inUse==ceiling");
  g.release(); // inUse=1 < ceiling(2) → grants the waiter
  await p;
  assert.equal(granted4, true, "grants once in-use drops below the lowered ceiling");
});

test("adaptive gate completes ALL work despite injected rate limits (never fails the run)", async () => {
  const g = makeAdaptiveSemaphore(10);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let injected = 0, completed = 0;
  async function fakeAgent() {
    if (injected < 5) { injected++; throw new Error("temporarily limiting requests · Rate limited"); }
    return "ok";
  }
  async function gatedCall() {
    await g.acquire();
    try {
      for (let a = 1; a <= 4; a++) {
        try { const r = await fakeAgent(); completed++; return r; }
        catch (e) { if (isRateLimit(e) && a < 4) { g.lower(); await sleep(5); continue; } throw e; }
      }
    } finally { g.release(); }
  }
  const items = Array.from({ length: 12 }, (_, i) => i);
  let errors = 0;
  await Promise.all(items.map(() => gatedCall().catch(() => { errors++; })));
  assert.equal(errors, 0, "no item failed — retries absorbed the rate limits");
  assert.equal(completed, 12, "all work completed");
  assert.ok(g.ceiling < 10, "ceiling lowered in response to the rate limits");
  assert.ok(g.ceiling >= MIN_CONCURRENT, "but never below the floor");
});
