#!/usr/bin/env node
/* Daily Journal Lite — zero-dependency test suite.
 *
 * Loads the JournalLite core logic directly from index.html (the region
 * between NODE-TEST-BEGIN and NODE-TEST-END markers), runs it inside a
 * Node vm sandbox with a mock localStorage, then exercises logging,
 * validation, search, weekly-summary, and CSV-export logic.
 *
 * Run: node tests/run-tests.js
 * Requires: Node (any recent version). No npm packages, no build step.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

/* ---------- load the core logic straight out of index.html ---------- */
var htmlPath = path.join(__dirname, '..', 'index.html');
var html = fs.readFileSync(htmlPath, 'utf8');
var match = html.match(/\/\*NODE-TEST-BEGIN\*\/([\s\S]*?)\/\*NODE-TEST-END\*\//);
assert.ok(match && match[1] && match[1].trim().length > 0,
  'index.html must contain a NODE-TEST-BEGIN/NODE-TEST-END core region');
var coreSrc = match[1];

function makeMockStorage() {
  var store = new Map();
  return {
    getItem: function (k) { return store.has(k) ? store.get(k) : null; },
    setItem: function (k, v) { store.set(String(k), String(v)); },
    removeItem: function (k) { store.delete(k); },
    clear: function () { store.clear(); },
    _map: store
  };
}

/* Fresh context = one fresh app "session". Passing the same mock storage
   simulates the app reloading while data persists in localStorage. */
function loadCore(mockStorage) {
  var sandbox = mockStorage ? { localStorage: mockStorage } : {};
  vm.createContext(sandbox);
  vm.runInContext(coreSrc, sandbox, { filename: 'journal-lite-core.js' });
  var JL = sandbox.JournalLite;
  assert.ok(JL && typeof JL.saveEntry === 'function',
    'core region must define the JournalLite API');
  return { JL: JL, sandbox: sandbox };
}

function pad(n) { return String(n).length < 2 ? '0' + n : n; }
/* Expected local calendar date — built from LOCAL date parts, so this
   test catches UTC-offset bugs in any timezone, not just UTC runners. */
function localISO(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/* ---------- helpers used by many tests ---------- */
function at(y, m, d, h, mi) { /* m is 1-based */
  return new Date(y, m - 1, d, h || 12, mi || 0, 0, 0);
}
function seedEntries(JL, seeds) {
  var out = [];
  seeds.forEach(function (s) {
    var r = JL.saveEntry({ mood: s.mood, energy: s.energy, text: s.text }, s.now);
    if (!r.ok) throw new Error('seed failed: ' + JSON.stringify(s));
    out.push(r.entry);
  });
  return out;
}

/* ---------- tests ---------- */
var tests = [];
var current = '';
function test(name, fn) {
  tests.push(function () {
    current = name;
    fn();
  });
}

/* ----- logging ----- */
test('two-tap log (mood + energy) saves with no text needed', function () {
  var JL = loadCore(makeMockStorage()).JL;
  var r = JL.saveEntry({ mood: 4, energy: 3, text: '' }, at(2026, 10, 26, 9, 14));
  assert.equal(r.ok, true);
  assert.equal(r.entry.mood, 4);
  assert.equal(r.entry.energy, 3);
  assert.equal(r.entry.text, '');
  assert.equal(r.entry.date, '2026-10-26');
  assert.ok(typeof r.entry.ts === 'number');
  assert.ok(/^jl_/.test(r.entry.id));
});

test('entry payload contains nothing extraneous (no streak/guilt fields)', function () {
  var JL = loadCore(makeMockStorage()).JL;
  var r = JL.saveEntry({ mood: 2, energy: 1, text: 'tough day' }, at(2026, 10, 26, 22));
  assert.deepEqual(Object.keys(r.entry).sort(),
    ['date', 'energy', 'id', 'mood', 'text', 'ts']);
});

test('empty draft is rejected with a gentle reason', function () {
  var JL = loadCore(makeMockStorage()).JL;
  var r = JL.saveEntry({}, at(2026, 10, 26));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'empty');
  assert.ok(typeof r.message === 'string' && r.message.length > 0);
});

test('whitespace-only text is rejected too', function () {
  var JL = loadCore(makeMockStorage()).JL;
  var r = JL.saveEntry({ text: '   \n  ' }, at(2026, 10, 26));
  assert.equal(r.ok, false);
});

test('text is trimmed on save', function () {
  var JL = loadCore(makeMockStorage()).JL;
  var r = JL.saveEntry({ text: '  coffee was good  ' }, at(2026, 10, 26));
  assert.equal(r.ok, true);
  assert.equal(r.entry.text, 'coffee was good');
});

test('line-only entry is allowed (two-tap is optional)', function () {
  var JL = loadCore(makeMockStorage()).JL;
  var r = JL.saveEntry({ text: 'just wanted to remember this' }, at(2026, 10, 26));
  assert.equal(r.ok, true);
  assert.equal(r.entry.mood, null);
  assert.equal(r.entry.energy, null);
});

test('single-dimension log (mood only) is allowed', function () {
  var JL = loadCore(makeMockStorage()).JL;
  var r = JL.saveEntry({ mood: 3 }, at(2026, 10, 26));
  assert.equal(r.ok, true);
  assert.equal(r.entry.mood, 3);
  assert.equal(r.entry.energy, null);
});

test('out-of-range and nonsense values normalize away (7, "banana", -1)', function () {
  var JL = loadCore(makeMockStorage()).JL;
  assert.equal(JL.normMood(7), null);
  assert.equal(JL.normMood(0), null);
  assert.equal(JL.normMood(-1), null);
  assert.equal(JL.normMood('banana'), null);
  assert.equal(JL.normEnergy(9), null);
  var r = JL.saveEntry({ mood: 7, energy: 'banana' }, at(2026, 10, 26));
  assert.equal(r.ok, false); /* nothing valid left, nothing entered as text */
});

test('mood/energy accepted by label as well as number', function () {
  var JL = loadCore(makeMockStorage()).JL;
  assert.equal(JL.normMood('Good'), 4);
  assert.equal(JL.normMood('good'), 4);
  assert.equal(JL.normEnergy('Steady'), 3);
  assert.equal(JL.normMood('Steady'), null); /* energy label must not leak into mood */
  assert.equal(JL.normEnergy('Great'), null);
});

test('labels round-trip: moodLabel/energyLabel', function () {
  var JL = loadCore(makeMockStorage()).JL;
  assert.equal(JL.moodLabel(5), 'Great');
  assert.equal(JL.moodLabel(1), 'Rough');
  assert.equal(JL.energyLabel(4), 'Buzzing');
  assert.equal(JL.moodLabel(null), '');
  assert.equal(JL.energyLabel(7), '');
});

test('multiple log entries are allowed per day, newest stored first', function () {
  var JL = loadCore(makeMockStorage()).JL;
  JL.saveEntry({ mood: 4, energy: 3 }, at(2026, 10, 26, 9));
  JL.saveEntry({ mood: 2, energy: 1 }, at(2026, 10, 26, 21));
  var all = JL.getEntries();
  assert.equal(all.length, 2);
  assert.equal(all[0].mood, 2); /* the 9pm log is newest */
  assert.equal(all[1].mood, 4);
});

test('ids are unique across saves', function () {
  var JL = loadCore(makeMockStorage()).JL;
  var a = JL.saveEntry({ mood: 3, energy: 3 }, at(2026, 10, 26, 9)).entry;
  var b = JL.saveEntry({ mood: 3, energy: 3 }, at(2026, 10, 26, 9)).entry;
  assert.notEqual(a.id, b.id);
});

/* ----- dates ----- */
test('todayISO pads month and day (no 2026-1-5 nonsense)', function () {
  var JL = loadCore(makeMockStorage()).JL;
  assert.equal(JL.todayISO(at(2026, 1, 5)), '2026-01-05');
  assert.equal(JL.todayISO(at(2026, 12, 31)), '2026-12-31');
});

test('todayISO uses LOCAL calendar day, not UTC (11:59pm stays same day)', function () {
  var JL = loadCore(makeMockStorage()).JL;
  var late = at(2026, 10, 26, 23, 59);
  assert.equal(JL.todayISO(late), localISO(late)); /* = '2026-10-26' */
  assert.equal(JL.formatTS(late.getTime()), localISO(late) + ' 23:59:00');
});

/* ----- persistence ----- */
test('entries persist across app "sessions" through localStorage', function () {
  var mock = makeMockStorage();
  var s1 = loadCore(mock);
  s1.JL.saveEntry({ mood: 4, energy: 4, text: 'before reload' }, at(2026, 10, 26, 10));
  var s2 = loadCore(mock); /* simulated reload with the same storage */
  var all = s2.JL.getEntries();
  assert.equal(all.length, 1);
  assert.equal(all[0].text, 'before reload');
  assert.equal(s2.JL.getEntryById(all[0].id).mood, 4);
  /* raw storage should be JSON under the known key */
  var raw = JSON.parse(mock.getItem('jl.entries.v1'));
  assert.equal(raw[0].id, all[0].id);
});

test('works even when localStorage is missing entirely (session fallback)', function () {
  var core = loadCore(null);
  var r = core.JL.saveEntry({ mood: 4, energy: 3 }, at(2026, 10, 26));
  assert.equal(r.ok, true);
  assert.equal(r.persisted, false);
  assert.equal(core.JL.getEntries().length, 1);
});

test('deleteEntry removes exactly one entry; clearAll wipes storage', function () {
  var mock = makeMockStorage();
  var JL = loadCore(mock).JL;
  var a = JL.saveEntry({ mood: 5, energy: 4 }, at(2026, 10, 26, 8)).entry;
  var b = JL.saveEntry({ mood: 2, energy: 1 }, at(2026, 10, 26, 20)).entry;
  assert.equal(JL.deleteEntry(a.id), 1);
  var left = JL.getEntries();
  assert.equal(left.length, 1);
  assert.equal(left[0].id, b.id);
  assert.equal(JL.deleteEntry('never-existed'), 0);
  JL.clearAll();
  assert.equal(JL.getEntries().length, 0);
  assert.ok(!mock._map.has('jl.entries.v1'));
});

/* ----- search ----- */
test('plain-word search finds entries by text, case-insensitively', function () {
  var JL = loadCore(makeMockStorage()).JL;
  seedEntries(JL, [
    { energy: 3, text: 'coffee with a friend, felt like a person', now: at(2026, 10, 20, 9) },
    { mood: 2, text: 'appointments all day', now: at(2026, 10, 21, 9) },
    { mood: 4, energy: 4, text: 'quiet evening', now: at(2026, 10, 22, 21) }
  ]);
  assert.equal(JL.searchEntries('coffee').length, 1);
  assert.equal(JL.searchEntries('COFFEE').length, 1);
  assert.equal(JL.searchEntries('quiet').length, 1);
});

test('multi-word search requires every word (AND), across text + tags + date', function () {
  var JL = loadCore(makeMockStorage()).JL;
  seedEntries(JL, [
    { mood: 2, energy: 1, text: 'tired but made food', now: at(2026, 10, 20, 9) },
    { mood: 4, energy: 3, text: 'long shift, tired anyway', now: at(2026, 10, 21, 9) },
    { mood: 1, energy: 1, text: 'beach day', now: at(2026, 10, 22, 9) }
  ]);
  var r1 = JL.searchEntries('tired steady');        /* word + energy tag */
  assert.equal(r1.length, 1);
  assert.equal(r1[0].text, 'long shift, tired anyway');
  var r2 = JL.searchEntries('tired Drained');       /* matching the energy label too */
  assert.equal(r2.length, 1);
  assert.equal(r2[0].text, 'tired but made food');
  assert.equal(JL.searchEntries('tired beach').length, 0); /* words in one haystack only */
  /* mood tag searchable as a plain word */
  assert.equal(JL.searchEntries('good').length, 1);
  /* date searchable as a plain string */
  assert.equal(JL.searchEntries('2026-10-20').length, 1);
  /* extra whitespace is forgiving */
  assert.equal(JL.searchEntries('  tired   steady  ').length, 1);
});

test('empty or blank search returns everything', function () {
  var JL = loadCore(makeMockStorage()).JL;
  seedEntries(JL, [
    { mood: 4, energy: 3, now: at(2026, 10, 20) },
    { text: 'note', now: at(2026, 10, 21) }
  ]);
  assert.equal(JL.searchEntries('').length, 2);
  assert.equal(JL.searchEntries('   ').length, 2);
  assert.equal(JL.searchEntries(null).length, 2);
});

test('search accepts an explicit list (input can bypass storage entirely)', function () {
  var JL = loadCore(makeMockStorage()).JL;
  var seeded = seedEntries(JL, [
    { text: 'ferries and high winds', now: at(2026, 10, 20) },
    { text: 'whiskers napped all day', now: at(2026, 10, 21) }
  ]);
  assert.equal(JL.searchEntries('whiskers', seeded).length, 1);
  assert.equal(JL.searchEntries('nothingmatches', seeded).length, 0);
});

/* ----- weekly summary ----- */
test('weekly summary counts only the trailing 7 days (older log excluded)', function () {
  var JL = loadCore(makeMockStorage()).JL;
  seedEntries(JL, [
    { mood: 5, energy: 4, text: 'eight days ago', now: at(2026, 10, 19, 9) },
    { mood: 4, energy: 3, text: 'seven days ago', now: at(2026, 10, 20, 9) },
    { mood: 2, energy: 1, text: 'inside the window', now: at(2026, 10, 25, 9) },
    { mood: 3, energy: 3, text: 'today', now: at(2026, 10, 26, 9) }
  ]);
  var ref = at(2026, 10, 26, 18); /* window: Oct 20 .. Oct 26 inclusive */
  var s = JL.weeklySummary(JL.getEntries(), ref);
  assert.equal(s.count, 3);
  assert.equal(s.windowStartISO, '2026-10-20');
  assert.equal(s.windowEndISO, '2026-10-26');
  assert.equal(s.generatedAtISO, '2026-10-26');
  assert.equal(s.moodTally[4], 1);
  assert.equal(s.moodTally[5], 0); /* the Oct 19 log must not leak in */
  assert.equal(s.daysActive, 3);
});

test('summary tallies moods and energies correctly', function () {
  var JL = loadCore(makeMockStorage()).JL;
  seedEntries(JL, [
    { mood: 4, energy: 3, now: at(2026, 10, 20) },
    { mood: 4, energy: 3, now: at(2026, 10, 22) },
    { mood: 5, energy: 4, now: at(2026, 10, 23) },
    { mood: 4, energy: 2, now: at(2026, 10, 24) },
    { mood: 1, energy: 1, now: at(2026, 10, 25) }
  ]);
  var s = JL.weeklySummary(JL.getEntries(), at(2026, 10, 26, 18));
  assert.equal(s.count, 5);
  assert.equal(s.moodLogged, 5);
  assert.equal(s.energyLogged, 5);
  assert.equal(s.moodTally[4], 3);
  assert.equal(s.energyTally[3], 2);
  assert.equal(s.topMood, 4);
  assert.equal(s.topMoodLabel, 'Good');
  assert.ok(Math.abs(s.topMoodShare - 0.6) < 1e-9);
});

test('empty week summary is warm, not guilty, and has no streak anywhere', function () {
  var JL = loadCore(makeMockStorage()).JL;
  var s = JL.weeklySummary([], at(2026, 10, 26, 18));
  assert.equal(s.count, 0);
  assert.equal(s.daysActive, 0);
  assert.ok(/fine|okay|completely/.test(s.message.toLowerCase()));
  assert.equal(s.topMoodLabel, null);
  var keys = Object.keys(s).join(' ');
  assert.ok(keys.indexOf('streak') === -1);
  assert.ok(/zero judgment/.test(s.message.toLowerCase()));
});

test('dominant mood gets named ("the week leaned Good")', function () {
  var JL = loadCore(makeMockStorage()).JL;
  seedEntries(JL, [
    { mood: 4, energy: 3, now: at(2026, 10, 20) },
    { mood: 4, energy: 3, now: at(2026, 10, 22) },
    { mood: 4, energy: 2, now: at(2026, 10, 23) },
    { mood: 1, energy: 1, now: at(2026, 10, 24) }
  ]);
  var s = JL.weeklySummary(JL.getEntries(), at(2026, 10, 26, 18));
  assert.equal(s.count, 4);
  assert.ok(/leaned Good/i.test(s.message));
});

test('tie or spread reads as a mixed week, never as a failing grade', function () {
  var JL = loadCore(makeMockStorage()).JL;
  seedEntries(JL, [
    { mood: 5, energy: 4, now: at(2026, 10, 20) },
    { mood: 5, energy: 4, now: at(2026, 10, 21) },
    { mood: 1, energy: 1, now: at(2026, 10, 22) },
    { mood: 1, energy: 1, now: at(2026, 10, 23) }
  ]);
  var s = JL.weeklySummary(JL.getEntries(), at(2026, 10, 26, 18));
  assert.ok(/mixed/i.test(s.message));
});

test('very few check-ins are framed as small and real, not as falling behind', function () {
  var JL = loadCore(makeMockStorage()).JL;
  seedEntries(JL, [{ mood: 2, energy: 1, now: at(2026, 10, 24) }]);
  var s = JL.weeklySummary(JL.getEntries(), at(2026, 10, 26, 18));
  assert.equal(s.count, 1);
  assert.ok(/small and still real/.test(s.message));
});

test('text-only (untagged) entries count in the week without breaking it', function () {
  var JL = loadCore(makeMockStorage()).JL;
  seedEntries(JL, [
    { text: 'just words today', now: at(2026, 10, 22) },
    { text: 'more words', now: at(2026, 10, 23) }
  ]);
  var s = JL.weeklySummary(JL.getEntries(), at(2026, 10, 26, 18));
  assert.equal(s.count, 2);
  assert.equal(s.moodLogged, 0);
  assert.ok(/untagged|notes/i.test(s.message));
});

test('weekly start-of-week boundary is inclusive on both ends (23:59 today counts)', function () {
  var JL = loadCore(makeMockStorage()).JL;
  seedEntries(JL, [
    { mood: 3, energy: 2, now: at(2026, 10, 20, 0, 0) },   /* first second of window */
    { mood: 3, energy: 2, now: at(2026, 10, 26, 23, 59) } /* last minute of window */
  ]);
  var s = JL.weeklySummary(JL.getEntries(), at(2026, 10, 26, 23, 59));
  assert.equal(s.count, 2);
  assert.equal(s.daysActive, 2);
});

/* ----- CSV export ----- */
test('CSV export: exact header, RFC-4180 quoting, ascending order, CRLF termination', function () {
  var JL = loadCore(makeMockStorage()).JL;
  seedEntries(JL, [
    { mood: 4, energy: 3, text: 'said "hi", twice', now: at(2026, 10, 26, 10, 15) },
    { text: 'multi\nline', now: at(2026, 10, 20, 8, 0) }
  ]);
  var csv = JL.csvForEntries(JL.getEntries());
  var lines = csv.split('\r\n');
  assert.equal(lines[0], 'date,created_at,mood_value,mood,energy_value,energy,note');
  assert.equal(lines[1], '2026-10-20,2026-10-20 08:00:00,,,,,"multi\nline"');
  assert.equal(lines[2], '2026-10-26,2026-10-26 10:15:00,4,Good,3,Steady,"said ""hi"", twice"');
  assert.equal(csv.endsWith('\r\n'), true);
  /* the newest entry must not come first: export is chronological */
  assert.equal(csv.indexOf('2026-10-20') < csv.indexOf('2026-10-26'), true);
});

test('CSV export leaves clean values unquoted and blanks blank', function () {
  var JL = loadCore(makeMockStorage()).JL;
  seedEntries(JL, [{ mood: 2, energy: 1, text: 'plain words', now: at(2026, 10, 21, 14, 30) }]);
  var csv = JL.csvForEntries(JL.getEntries());
  var lines = csv.split('\r\n').filter(function (l) { return l !== ''; });
  assert.equal(lines.length, 2);
  assert.equal(lines[1], '2026-10-21,2026-10-21 14:30:00,2,Low,1,Drained,plain words');
});

test('CSV export reflects exactly the entries passed / all entries by default', function () {
  var JL = loadCore(makeMockStorage()).JL;
  seedEntries(JL, [
    { mood: 4, energy: 3, now: at(2026, 10, 20) },
    { mood: 1, energy: 1, now: at(2026, 10, 25) }
  ]);
  var csv = JL.csvForEntries(JL.getEntries());
  assert.equal(csv.split('\r\n').filter(function (l) { return l !== ''; }).length, 3);
  var csv2 = JL.csvForEntries([JL.getEntries()[0]]);
  assert.equal(csv2.split('\r\n').filter(function (l) { return l !== ''; }).length, 2);
});

/* ---------- runner ---------- */
var passed = 0;
var failures = [];
tests.forEach(function (run) {
  try {
    run();
    passed++;
    console.log('PASS ' + current);
  } catch (err) {
    failures.push({ name: current, err: err });
    console.log('FAIL ' + current + ' :: ' + (err && err.message ? err.message : err));
  }
});
console.log('');
console.log(passed + ' passed, ' + failures.length + ' failed (' + tests.length + ' total)');
if (failures.length > 0) process.exit(1);
