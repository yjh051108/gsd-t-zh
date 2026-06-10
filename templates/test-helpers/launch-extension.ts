/**
 * launch-extension.ts — GSD-T template: launch Chromium with an unpacked MV3
 * extension WITHOUT stealing focus or taking over the developer's screen.
 *
 * Copy into e2e/helpers/ and set EXTENSION_PATH for your project.
 * Origin: binvoice 2026-06-10 (see GSD-T CHANGELOG 4.4.11).
 *
 * THE INVARIANT: E2E tests must NEVER steal keyboard focus. On macOS a headed
 * Chromium launch ACTIVATES the app — yanking the cursor out of the terminal —
 * regardless of window position. Off-screen windows do NOT fix this; only a
 * truly headless launch does.
 *
 * Modes:
 *   1. NEW HEADLESS (DEFAULT) — full-Chromium new headless via
 *      `channel: 'chromium'` + `headless: true`. Loads MV3 extensions and
 *      registers service workers. No window, no activation, no focus theft.
 *      PITFALL this template exists to encode: `headless: true` ALONE launches
 *      Playwright's chromium_headless_shell (OLD headless — silently cannot
 *      load extensions), and passing `--headless=new` as a raw arg fights that
 *      binary instead of selecting the right one. `channel: 'chromium'` is the
 *      load-bearing line.
 *   2. OFF-SCREEN HEADED — fallback if a future Chrome regresses new-headless
 *      extension support. Prevents screen takeover but NOT macOS focus theft.
 *   3. HEADED — visible window for watching a run. Opt-in only, never default.
 *
 * Env:
 *   HEADED=1            → mode 3 (visible window).
 *   E2E_MODE=offscreen  → mode 2 (fallback).
 *   (unset)             → mode 1 (new headless — the default).
 */

import { chromium, type BrowserContext } from '@playwright/test';
import { resolve } from 'path';

// Adjust for your project: path to the built unpacked extension.
export const EXTENSION_PATH = resolve(__dirname, '../../dist');

type Mode = 'newheadless' | 'offscreen' | 'headed';

function resolveMode(): Mode {
  if (process.env['HEADED'] === '1') return 'headed';
  if (process.env['E2E_MODE'] === 'offscreen') return 'offscreen';
  if (process.env['E2E_MODE'] === 'headed') return 'headed';
  return 'newheadless';
}

function baseArgs(): string[] {
  return [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--no-sandbox',
  ];
}

export async function launchExtensionContext(): Promise<BrowserContext> {
  const mode = resolveMode();
  const args = baseArgs();

  if (mode === 'newheadless') {
    return chromium.launchPersistentContext('', {
      channel: 'chromium', // load-bearing: full build → new headless → extensions work
      headless: true,
      args,
    });
  }

  if (mode === 'offscreen') {
    return chromium.launchPersistentContext('', {
      headless: false,
      args: [
        ...args,
        '--window-position=-2400,-2400',
        '--window-size=400,300',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
  }

  return chromium.launchPersistentContext('', { headless: false, args });
}
