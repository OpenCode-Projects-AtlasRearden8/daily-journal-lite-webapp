# Daily Journal Lite

An ADHD-friendly, offline, **no-guilt** journaling web app. Two taps to log your
mood and energy, an optional one-line check-in, a streak-free timeline, plain-word
search, a gentle weekly summary, and CSV export — all in one HTML file, all stored
locally in your browser.

No accounts. No internet. No streak counters. No shame.

Part of the **Asdale Dynamics gentle-tools family**. It pairs naturally with:

- **gentle-productivity-manual** — the "why": low-energy, ADHD-friendly ways to
  work with your brain instead of against it. This app is the daily practice of
  that philosophy.
- **note-to-task-extractor-cli** — the "next step": turn the lines you write here
  into tasks later. Journal in the app, export the CSV, let the extractor pull
  out what needs doing.

## What it does

- **Two-tap logging** — tap a mood (Rough → Great), tap an energy level
  (Drained → Buzzing): the entry saves itself. That is the entire core loop.
- **One-line check-in with ignorable prompts** — a rotating gentle prompt sits
  above a single text box. Write a line and save it alone, or leave the box
  empty; prompts are explicitly optional, and blank is treated as a valid answer.
- **Streak-free timeline** — entries grouped by day, newest first. No streak
  counters, no scores, no red "missed days", nothing to break. A gap is just a
  gap. The only counts shown are positive ones ("12 entries so far — every one
  of them counts").
- **Plain-word search** — type normal words like `coffee appointment`. Every
  word must appear somewhere in the date, note, mood tag, or energy tag. No
  syntax, no operators, case-insensitive.
- **Weekly gentle summary card** — the last 7 days: how many check-ins, how
  many different days, mood and energy spreads as simple bars, and a soft
  one-line read ("A mixed week — moods took turns, the way weeks do."). Empty
  weeks get told they are fine. Week-to-week comparison is deliberately missing.
- **CSV export** — download, copy, or just view all your entries as a clean,
  RFC-4180-friendly CSV that opens in Excel, Numbers, or Google Sheets.
- **Undo & gentle deletes** — accidental saves get an Undo button on the toast;
  every timeline entry has a two-step "Remove" (no instant bans by fat fingers).
- **Local-first privacy** — entries live only in your browser's localStorage on
  your device. Nothing syncs and nothing uploads. If storage is blocked
  (some private modes), the app tells you and still works for the session.
- **Dark mode** — follows your system preference automatically.

## Run it

No build, no dependencies, no server required:

1. Download (or clone) this folder.
2. Double-click `index.html` — it opens from `file://` and just works.

Optional, if you prefer serving it:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Test it

The test suite is a single zero-dependency Node script. It loads the app's core
logic *directly out of `index.html`* (so tests always run the shipped code, not
a copy) and exercises logging, validation, persistence, search, summary, and
CSV logic in a sandbox with a mock localStorage:

```bash
node tests/run-tests.js
```

Expected output ends with `32 passed, 0 failed`.

## Your data

Everything is stored under the localStorage key `jl.entries.v1` as a JSON array.
One entry looks like:

```json
{
  "id": "jl_xyz123_ab1c2d",
  "ts": 1799000000000,
  "date": "2026-10-26",
  "mood": 4,
  "energy": 3,
  "text": "coffee was warm and so was the morning"
}
```

- `mood`: `1` Rough, `2` Low, `3` Okay, `4` Good, `5` Great (or `null`)
- `energy`: `1` Drained, `2` Low, `3` Steady, `4` Buzzing (or `null`)
- `date` is your **local** calendar day, so an 11pm entry belongs to today,
  wherever you live relative to UTC.

CSV columns: `date, created_at, mood_value, mood, energy_value, energy, note`
(rows oldest → newest, timestamps in local time).

## Project layout

```
index.html          the entire app: markup, styles, logic, UI (one file)
tests/run-tests.js  zero-dependency test suite (Node, no npm install)
README.md           this file
LICENSE             MIT, Copyright (c) 2026 Asdale Dynamics, LLC
STATUS.md            current build/verification status
```

## Design principles (the no-guilt part)

1. **The cheapest action is the main action.** Mood + energy is two taps and
   saves itself; anything more is opt-in.
2. **Opt-out is always visible.** Prompts say they are ignorable; blank lines
   are called valid; empty weeks are called fine.
3. **No counters that can fail.** Streaks, scores, and missed-day tallies are
   absent by design — only positive framing exists ("entries so far").
4. **Information, not homework.** The weekly card shows spreads, never targets,
   and never compares this week to last week.
5. **Every mistake is reversible.** Undo on save, two-step deletes.
6. **Your words are yours.** Local storage, one-click export, no cloud.

## About

Daily Journal Lite was written by **Asdale Dynamics, LLC** — Dylan Asdale's
AI-education studio ("AI explained like a friend would"). See
[dylanasdale.github.io](https://dylanasdale.github.io) for the manual, guides,
and other tools.

This is a journaling and self-reflection tool. It is not a medical or mental
health device, and it does not diagnose, treat, or advise.

## License

[MIT](LICENSE) — Copyright (c) 2026 Asdale Dynamics, LLC
