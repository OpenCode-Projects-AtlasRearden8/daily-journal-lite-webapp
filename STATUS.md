# STATUS — Daily Journal Lite

Date: 2026-10-26
Maintained by Asdale Dynamics, LLC

## What was built

An ADHD-friendly, offline, no-guilt journaling single-page web app:

- `index.html` — the entire app in one file (HTML + CSS + JS inline, zero
  dependencies, works from `file://`). Includes:
  - Two-tap mood (Rough/Low/Okay/Good/Great) and energy
    (Drained/Low/Steady/Buzzing) logging that auto-saves on the second tap,
    with an Undo button on the confirmation toast.
  - Optional one-line check-in with a rotating gentle prompt (shuffle
    supported); prompts are explicitly ignorable and blank lines are valid
    ("Save line only" allows text-only entries).
  - Streak-free timeline grouped by local calendar day, newest first; no
    streak counters, scores, or missed-day shaming; two-step entry removal.
  - Plain-word search (case-insensitive, every word must match) across
    notes, mood/energy tags, and dates.
  - Weekly gentle summary card for the trailing 7 local days: check-in count,
    distinct days, mood/energy spreads as bars, and a soft generated
    one-line read. No week-to-week comparison by design.
  - CSV export (download via Blob, copy to clipboard with fallback, or view
    inline), RFC-4180 quoting, rows oldest → newest.
  - All data in localStorage under `jl.entries.v1`; graceful in-memory
    fallback if storage is missing/blocked (with a visible heads-up banner).
  - Dark mode via `prefers-color-scheme`; accessible tap targets, labels,
    and ARIA attributes.
- `tests/run-tests.js` — zero-dependency Node test suite. It extracts the
  core logic region from `index.html` (between NODE-TEST-BEGIN/NODE-TEST-END
  markers) and runs it in a `vm` sandbox with a mock localStorage, so the
  tests always execute the shipped code, not a copy.
- `README.md`, `LICENSE` (MIT, "Copyright (c) 2026 Asdale Dynamics, LLC"),
  and this `STATUS.md`.
- Git repository initialized locally (nothing remote, nothing published).

## How to run

- Open `index.html` by double-clicking it (fully functional from `file://`),
  or serve it: `python3 -m http.server 8000`.
- Run tests: `node tests/run-tests.js` (any recent Node; no npm install).
- Optional: `node --check tests/run-tests.js` for a quick syntax check.

## Verification results

- `node tests/run-tests.js` — **32 passed, 0 failed (32 total)**, covering:
  - Logging: two-tap save, text-only and single-dimension saves, trimming,
    rejection of empty drafts, value/label normalization, per-day multiple
    entries, unique ids, exact payload shape (no streak/guilt fields).
  - Dates: local calendar day (not UTC), zero-padding, 11:59pm boundary.
  - Persistence: entries survive across sessions via localStorage; works
    without storage (session fallback); deleteEntry/clearAll exact behavior.
  - Search: plain words, case-insensitivity, multi-word AND semantics across
    text + tags + dates, explicit-list input, empty query returns all.
  - Weekly summary: trailing-7-day window (older entries excluded), tallies,
    top-mood/share, warm messages for empty/small/mixed weeks, untagged-note
    handling, inclusive window boundaries, no streak fields.
  - CSV: exact header, RFC-4180 quoting of commas/quotes/newlines, blank
    fields, chronological order, CRLF line endings.
- Test suite exit code is 0 on success and 1 on any failure.
- The app itself was reviewed for the `file://` constraint: no fetch, no
  external assets, no module imports; everything inline.

## Known gaps

- No CSV **import** yet (export only); restoring a backup means pasting rows
  back in by hand. Import is the most likely next feature.
- UI flows (tabs, toast, timeline rendering, export buttons) are verified by
  code review, not automated browser tests; only the core logic is covered by
  the test suite (browser automation would need a dependency, which the
  zero-dependency constraint forbids).
- Search is simple substring matching on words, not fuzzy or stemming-aware.
- localStorage is per-browser/per-device by design (local-first); there is no
  sync, and storage size limits (a few MB) could welcome thousands of entries
  but not a lifetime of them — export occasionally.
- The weekly summary uses the trailing 7 days (rolling), not calendar weeks.
- Mood/energy scales are fixed (5-point mood, 4-point energy); not
  configurable. Deliberate, but worth revisiting based on feedback.

## Housekeeping notes

- LICENSE copyright line is exactly: `Copyright (c) 2026 Asdale Dynamics, LLC`.
- README credits Asdale Dynamics, LLC and links the companion projects
  (gentle-productivity-manual, note-to-task-extractor-cli).
- No secrets, API keys, or personal data exist in any file.
